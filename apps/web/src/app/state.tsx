/**
 * App state: who is looking (persona), where they are (screen in the URL
 * hash), the case drawer any screen can open, the Director (running scenario,
 * current step, what changed) and the highlight set the Director paints.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { api, bump, post, setPersonaKey, useVersion } from '../lib/api';

export type PersonaInfo = { key: string; name: string; name_ar: string; role: string; role_ar: string; initials: string; sees: string; owns: string[]; home: string; suggestions: string[]; suggestions_ar: string[]; rmId?: string | null; scope?: any };
export type Session = { persona: PersonaInfo; personas: PersonaInfo[]; clock: { now: string; today: string; virtual: boolean }; ai: { mode: 'claude' | 'offline'; model: string; via?: string }; policyVersion: number; inbox: number; scenario: { key: string; step: number } | null; edge: Record<string, string> };

export type Changes = { cases: { ref: string; state: string; close_code: string | null; customer_id: string }[]; messages: { id: number; channel: string; status: string; message_type: string; customer_id: string; block_reason: string | null }[]; documents: { id: number; type: string; state: string; recommendation: string | null }[]; proposals: number; tasks: { id: number; kind: string; assignee_persona: string; title: string }[]; trail: number; activity: { id: number; agent: string | null; action: string; result: string; clause: string | null }[]; policyVersion: number | null };
export type DirectorStep = { id: string; title: string; title_ar: string; narration: string; narration_ar: string; trigger: string; action: { kind: string }; screen: string; screenResolved: string; persona?: string };
export type Director = { key: string; name: string; steps: DirectorStep[]; index: number; status: 'idle' | 'running' | 'done'; result: string | null; error: string | null; changes: Changes | null; auto: boolean; autoMs: number; busy: boolean; clock?: { now: string; today: string }; restored?: string[]; /** the current step is a hand step the Director has not executed: the room can do it, or → does it */ pending: boolean; hand: boolean };
/** Steps a person in the room can do by hand instead of the Director (mirrors HAND_KINDS on the server). */
export const HAND_KINDS = new Set(['customer_upload', 'customer_reply', 'customer_accept_offer', 'decide', 'decide_employer', 'approve_policy']);
/** The hand action a UI event reports, matched to the step kinds it completes. */
export const HAND_EVENT: Record<string, string[]> = { customer_upload: ['customer_upload'], customer_reply: ['customer_reply'], customer_accept_offer: ['customer_accept_offer'], decide: ['decide', 'decide_employer', 'approve_policy'] };

type Route = { screen: string; param: string | null };
const parseHash = (): Route => { const h = window.location.hash.replace(/^#\/?/, ''); const i = h.indexOf('/'); return i < 0 ? { screen: h || '', param: null } : { screen: h.slice(0, i), param: decodeURIComponent(h.slice(i + 1)) }; };

export const MENU = ['overview', 'inbox', 'customers', 'employers', 'health', 'cases', 'comms', 'documents', 'policies', 'agents', 'workflows', 'triggers', 'scenarios', 'audit', 'customer-app', 'settings', 'present'];

type Ctx = {
  session: Session | null; persona: PersonaInfo | null; switchPersona: (key: string) => void; reloadSession: () => Promise<Session | undefined>;
  route: Route; go: (screen: string, param?: string | null) => void; open: (ref: string) => void;
  caseRef: string | null; openCase: (ref: string | null) => void;
  director: Director | null; startScenario: (key: string) => Promise<void>; stepScenario: (dir: 1 | -1 | 0) => Promise<void>; stopScenario: () => void; setAuto: (b: boolean, ms?: number) => void;
  /** On the Stage, hand steps are reached without executing them; the room acts, or → lets the Director act. */
  setHandSteps: (b: boolean) => void; completeStep: (kind?: string) => Promise<void>;
  highlight: { cases: Set<string>; messages: Set<number>; documents: Set<number>; tasks: Set<number>; customers: Set<string>; at: number };
  activityOpen: boolean; setActivityOpen: (b: boolean) => void;
};
const AppCtx = createContext<Ctx | null>(null);

export function AppState({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [route, setRoute] = useState<Route>(parseHash);
  const [caseRef, setCaseRef] = useState<string | null>(null);
  const [director, setDirector] = useState<Director | null>(null);
  const [highlight, setHighlight] = useState<Ctx['highlight']>({ cases: new Set(), messages: new Set(), documents: new Set(), tasks: new Set(), customers: new Set(), at: 0 });
  const [activityOpen, setActivityOpen] = useState(false);
  const v = useVersion();
  const autoTimer = useRef<number | null>(null);
  const handSteps = useRef(false);
  const setHandSteps = useCallback((b: boolean) => { handSteps.current = b; }, []);
  const directorRef = useRef<Director | null>(null);

  const loadSession = useCallback(async () => { try { const s = await api<Session>('/me'); setSession(s); return s; } catch { return undefined; } }, []);
  useEffect(() => { loadSession(); }, [loadSession, v]);
  useEffect(() => { const on = () => setRoute(parseHash()); window.addEventListener('hashchange', on); return () => window.removeEventListener('hashchange', on); }, []);
  const persona = session?.persona ?? null;
  useEffect(() => { if (persona && (!route.screen || !MENU.includes(route.screen))) window.location.hash = `#/${persona.home}`; }, [persona, route.screen]);

  const go = useCallback((screen: string, param: string | null = null) => { window.location.hash = `#/${screen}${param ? `/${encodeURIComponent(param)}` : ''}`; window.scrollTo({ top: 0 }); }, []);
  /** Open a screen reference as the Director or Dalil names it: "case:REF", "customer:ID", "document:12", "comms:status=BLOCKED", "audit:customer=ID", "policies:POL-01", "agents:hami", "employer:ID", "customer-app:ID", "mailbox:ID". */
  const open = useCallback((ref: string) => {
    const i = ref.indexOf(':'); const kind = i < 0 ? ref : ref.slice(0, i); const param = i < 0 ? null : ref.slice(i + 1);
    if (kind === 'case' && param) { go('cases', param); setCaseRef(param); return; }
    setCaseRef(null); // any other screen: the case drawer would hide it
    if (kind === 'customer') return go('customers', param);
    if (kind === 'employer') return go('employers', param);
    if (kind === 'document') return go('documents', param);
    if (kind === 'customer-app') return go('customer-app', param);
    if (kind === 'mailbox') return go('comms', `mailbox=${param}`);
    if (kind === 'comms' || kind === 'audit' || kind === 'policies' || kind === 'agents' || kind === 'workflows') return go(kind, param);
    go(kind, param);
  }, [go]);

  const switchPersona = useCallback((key: string) => { setPersonaKey(key); setCaseRef(null); loadSession().then((s) => { if (s && !MENU.includes(route.screen)) window.location.hash = `#/${s.persona.home}`; }); }, [loadSession, route.screen]);

  const paint = useCallback((ch: Changes | null) => {
    if (!ch) return;
    setHighlight({ cases: new Set(ch.cases.map((c) => c.ref)), messages: new Set(ch.messages.map((m) => m.id)), documents: new Set(ch.documents.map((d) => d.id)), tasks: new Set(ch.tasks.map((t) => t.id)), customers: new Set(ch.cases.map((c) => c.customer_id)), at: Date.now() });
  }, []);

  const runIndex = useCallback(async (key: string, index: number, steps: DirectorStep[], mode: 'run' | 'wait' | 'done' = 'run') => {
    setDirector((d) => d && { ...d, busy: true, index });
    const st = steps[index];
    if (st?.persona && st.persona !== (session?.persona.key)) { setPersonaKey(st.persona); await loadSession(); }
    try {
      const r = await post(`/scenarios/${key}/step`, { index, mode });
      bump();
      if (mode !== 'wait') paint(r.changes);
      setDirector((d) => d && { ...d, busy: false, index, result: r.result, error: r.error, changes: mode === 'wait' ? null : r.changes, clock: r.clock, pending: mode === 'wait', hand: !!r.hand, status: index >= steps.length - 1 && mode !== 'wait' ? 'done' : 'running', steps: d.steps.map((s, i) => (i === index ? { ...s, screenResolved: r.step.screenResolved } : s)) });
      open(r.step.screenResolved);
      await loadSession();
    } catch (e: any) { setDirector((d) => d && { ...d, busy: false, error: e.message }); }
  }, [session?.persona.key, loadSession, paint, open]);
  const modeFor = useCallback((st: DirectorStep | undefined): 'run' | 'wait' => (handSteps.current && st && HAND_KINDS.has(st.action.kind) ? 'wait' : 'run'), []);

  const startScenario = useCallback(async (key: string) => {
    const r = await post(`/scenarios/${key}/start`);
    setDirector({ key, name: r.scenario.name, steps: r.scenario.steps, index: -1, status: 'running', result: null, error: null, changes: null, auto: false, autoMs: 9000, busy: false, restored: r.restored ?? [], pending: false, hand: false });
    if (r.restored?.length) bump();
    await runIndex(key, 0, r.scenario.steps, modeFor(r.scenario.steps[0]));
  }, [runIndex, modeFor]);
  const stepScenario = useCallback(async (dir: 1 | -1 | 0) => {
    if (!director || director.busy) return;
    const next = dir === 0 ? director.index : director.index + dir;
    if (next < 0 || next >= director.steps.length) return;
    if (dir === -1) { const st = director.steps[next]; setDirector((d) => d && { ...d, index: next, result: 'Showing (back)', changes: null, pending: false }); if (st.persona) { setPersonaKey(st.persona); await loadSession(); } open(st.screenResolved); return; }
    // A pending hand step: → makes the Director do it now, and the index stays.
    if (dir === 1 && director.pending) { await runIndex(director.key, director.index, director.steps, 'run'); return; }
    await runIndex(director.key, next, director.steps, modeFor(director.steps[next]));
  }, [director, runIndex, loadSession, open, modeFor]);
  /** The room did the pending step by hand: record it, show what changed, then move on after a beat. */
  const completing = useRef(false);
  /**
   * The room did a hand action (`kind`: customer_upload, customer_reply,
   * customer_accept_offer, decide). The story jumps to the next hand step
   * that action completes — the pending one, or a later one if the room
   * acted early — marks it done by hand, and moves on after a beat. Without
   * a kind (the "Done, continue" button) the pending step is taken as done.
   */
  const completeStep = useCallback(async (kind?: string) => {
    const d = directorRef.current;
    if (!d || d.busy || d.status !== 'running' || completing.current) return;
    const accepts = kind ? (HAND_EVENT[kind] ?? []) : null;
    let j = -1;
    if (!accepts) { if (d.pending) j = d.index; }
    else if (d.pending && accepts.includes(d.steps[d.index].action.kind)) j = d.index;
    else j = d.steps.findIndex((s, i) => i > d.index && accepts.includes(s.action.kind));
    if (j < 0) return;
    completing.current = true;
    try {
      await runIndex(d.key, j, d.steps, 'done');
      const next = j + 1;
      if (next >= d.steps.length) return;
      await new Promise((r) => window.setTimeout(r, 1400));
      const cur = directorRef.current; if (!cur || cur.key !== d.key || cur.index !== j) return;
      await runIndex(d.key, next, d.steps, modeFor(d.steps[next]));
    } finally { completing.current = false; }
  }, [runIndex, modeFor]);
  useEffect(() => { directorRef.current = director; }, [director]);
  const stopScenario = useCallback(() => { post('/scenarios/stop').catch(() => {}); setDirector(null); setCaseRef(null); if (autoTimer.current) window.clearTimeout(autoTimer.current); }, []);
  /** Auto-play on or off, optionally with a new interval (9 s at 1×; the Present bar offers 2× and 4×). */
  const setAuto = useCallback((b: boolean, ms?: number) => setDirector((d) => d && { ...d, auto: b, autoMs: ms ?? d.autoMs ?? 9000 }), []);
  useEffect(() => {
    if (!director?.auto || director.busy || director.status !== 'running') return;
    autoTimer.current = window.setTimeout(() => { stepScenario(1); }, director.autoMs ?? 9000);
    return () => { if (autoTimer.current) window.clearTimeout(autoTimer.current); };
  }, [director?.auto, director?.autoMs, director?.busy, director?.index, director?.status, stepScenario]);

  const value = useMemo<Ctx>(() => ({ session, persona, switchPersona, reloadSession: loadSession, route, go, open, caseRef, openCase: setCaseRef, director, startScenario, stepScenario, stopScenario, setAuto, setHandSteps, completeStep, highlight, activityOpen, setActivityOpen }),
    [session, persona, switchPersona, loadSession, route, go, open, caseRef, director, startScenario, stepScenario, stopScenario, setAuto, setHandSteps, completeStep, highlight, activityOpen]);
  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
}
export function useApp(): Ctx { const c = useContext(AppCtx); if (!c) throw new Error('useApp outside AppState'); return c; }

/** Class name that flashes when the Director touched this record in the last few seconds. */
export function useFlash(kind: 'cases' | 'messages' | 'documents' | 'tasks' | 'customers', id: string | number | null | undefined, row = false) {
  const { highlight } = useApp();
  const [on, setOn] = useState(false);
  useEffect(() => {
    if (id === null || id === undefined) return;
    const hit = (highlight[kind] as Set<any>).has(id) && Date.now() - highlight.at < 6000;
    setOn(hit);
    if (hit) { const t = window.setTimeout(() => setOn(false), 3200); return () => window.clearTimeout(t); }
  }, [highlight, kind, id]);
  return on ? (row ? 'flash-row' : 'flash') : '';
}
