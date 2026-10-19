/**
 * Present mode — the demo without PowerPoint.
 *
 * A storyline is a list of chapters. A *card* chapter is drawn full screen by
 * the app itself (QIB's hero island, one claim per card, live numbers from
 * the data). A *scenario* chapter hands the room to the Director with the
 * menu and the chat rail hidden, and is followed by an *interlude* card whose
 * numbers are counted from the trail, so they are true for what the room just
 * saw. The right arrow moves through everything — cards, Director steps,
 * interludes — so the presenter never touches the mouse.
 *
 * Storylines are edited in Settings → Demo and stored on the server
 * (layer.meta); the QIB default ships here and is merged with what is stored.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { cn } from '@cognirise/atelier/lib/utils';
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Loader2, Maximize2, Minimize2, Pause, Play, Plus, Trash2, X } from 'lucide-react';
import { api, useApi } from '../lib/api';
import { num, pct } from '../lib/format';
import { useApp } from './state';
import { Btn, Chip, Field, Note, Select } from './ui';

// ------------------------------------------------------------------ model
export type CardLayout = 'statement' | 'steps' | 'columns' | 'agenda';
export type CardChapter = { kind: 'card'; id: string; layout: CardLayout; eyebrow?: string; title: string; lines: string[] };
export type ScenarioChapter = { kind: 'scenario'; id: string; scenario: string; audience?: string; question?: string };
export type Chapter = CardChapter | ScenarioChapter;
export type Storyline = { id: string; name: string; chapters: Chapter[] };
export type Tally = { entries: number; agent_actions: number; human_decisions: number; overrides: number; record_writes: number; blocked: number; offers: number; examined: number; requalified: number; sent: number; agents: number; customers: number; clauses: number };

/** Tokens a card may use; filled from the live data when the card is shown. */
export const TOKENS = ['{customers}', '{eligible}', '{eligibleRate}', '{fallouts}', '{curable}', '{curablePct}', '{classA}', '{classB}', '{policyVersion}', '{today}'];

export const DEFAULT_STORYLINES: Storyline[] = [{
  id: 'qib', name: 'QIB · One Click readiness', chapters: [
    { kind: 'card', id: 'open', layout: 'statement', eyebrow: 'One Click Finance · Qatar Islamic Bank', title: 'Tonight, {eligibleRate} of your {customers} customers can be pre-approved.', lines: ['The other {fallouts} fall out for one of twenty reasons, from an expired Qatar ID to an employer the bank has not approved.', '{curable} of them ({curablePct}) are curable: {classA} by asking the customer for one thing, {classB} by one decision inside the bank.', 'Today, nobody is chasing them.'] },
    { kind: 'card', id: 'loop', layout: 'steps', eyebrow: 'What Jahiz does', title: 'Jahiz keeps the base ready, every night.', lines: ['Finds the reason each customer fell out', 'Asks the customer for exactly the one thing that is missing, in the QIB app first', 'Reads what comes back', 'Proposes the record change for a person to approve', 'Re-qualifies the customer and hands the One Click offer back to the app'] },
    { kind: 'card', id: 'promise', layout: 'statement', eyebrow: 'The rule behind it', title: 'Agents check, prepare and recommend, and people decide.', lines: ['No record in the core bank changes without a person\'s approval.', 'Every message passes the policy guard before it leaves, and a blocked message says which clause stopped it.', 'Everything an agent may do is a setting; everything it does is on an append-only trail.'] },
    { kind: 'card', id: 'agenda', layout: 'agenda', eyebrow: 'The next thirty minutes', title: 'Three customers, live, through the real engine.', lines: ['Nothing is pre-recorded. Every step runs the same code a click would run.'] },
    { kind: 'scenario', id: 's1', scenario: 'S1', audience: 'everyone', question: 'Who in this room would have clicked approve?' },
    { kind: 'scenario', id: 's2', scenario: 'S2', audience: 'Credit Policy', question: 'How long does one employer approval take today?' },
    { kind: 'scenario', id: 's3', scenario: 'S3', audience: 'Compliance and the RMs', question: 'Which clause would your team have cited?' },
    { kind: 'card', id: 'real', layout: 'columns', eyebrow: 'Honest boundaries', title: 'What is real, what is Claude and what is simulated.', lines: ['## Real', 'The eligibility arithmetic: the twenty reasons, capacity and cap, tenor and age, checked by 21 automated tests', 'The policy model, its versions and the guard that applies them', 'The case lifecycle, maker-checker, the append-only trail and the integration log', '## Claude', 'Reading document images: QID, passport, salary certificate, letters', 'Classifying customer replies: document, question, opt-out, hardship, complaint', 'Dalil\'s answers, with the clause cited, and drafts for a person to review', '## Simulated', 'The pre-approval model\'s score and the bank\'s rating', 'The core banking system: a schema behind one connector that logs every call', 'Push, SMS, e-mail and in-app delivery; the One Click hand-off; the clock', 'Every customer, employer and document, prefixed DEMO'] },
    { kind: 'card', id: 'settings', layout: 'steps', eyebrow: 'Your rules', title: 'Every rule QIB will want to set is already a setting, with a default.', lines: ['The definitions behind reasons 1, 3, 4, 5 and 13 · Policies → Eligibility and Evidence', 'Explained salary gaps, per segment · Policies → Evidence', 'Employer approval criteria and who decides · Policies → Evidence', 'Segments and RM ownership · Policies → Segments', 'Contact rules, channels and the calendar · Policies → Contact policy', 'Consent, opt-outs and do-not-contact · Policies → Privacy', 'One Click cut-offs, arrears and retention · Policies → Eligibility, Suppression, Retention'] },
    { kind: 'card', id: 'next', layout: 'statement', eyebrow: 'Next step', title: 'A half-day in Policies with your Credit Policy team.', lines: ['Your thresholds, segment names and employer criteria typed into the prototype on this screen, as a new policy version.', 'Then the same three customers again, under your rules.'] },
  ],
}];

export function mergeStorylines(stored: Storyline[] | null | undefined): Storyline[] {
  const list = [...DEFAULT_STORYLINES.map((d) => (stored ?? []).find((s) => s.id === d.id) ?? d), ...(stored ?? []).filter((s) => !DEFAULT_STORYLINES.some((d) => d.id === s.id))];
  return list;
}

type Item = { type: 'card'; chapter: CardChapter } | { type: 'scenario'; chapter: ScenarioChapter } | { type: 'interlude'; chapter: ScenarioChapter };
const expand = (s: Storyline): Item[] => s.chapters.flatMap((c): Item[] => (c.kind === 'card' ? [{ type: 'card', chapter: c }] : [{ type: 'scenario', chapter: c }, { type: 'interlude', chapter: c }]));

export type PresentView = 'stage' | 'app';
type PresentState = { storylineId: string; index: number; floor: number; activityFloor: number; startedAt: number; tally: Tally | null; elapsedMs: number; view: PresentView };
type PresentCtx = {
  present: PresentState | null; storylines: Storyline[]; storyline: Storyline | null; items: Item[]; item: Item | null;
  start: (storylineId: string) => void; exit: () => void; next: () => void; prev: () => void; goTo: (index: number) => void;
  fullscreen: boolean; toggleFullscreen: () => void; busy: boolean; reloadStorylines: () => void;
  /** How a scenario chapter is shown: the three-pane Stage, or the product's own screens. */
  setView: (v: PresentView) => void;
};
const Ctx = createContext<PresentCtx | null>(null);
const STORE = 'jahiz-present';

export function PresentProvider({ children }: { children: ReactNode }) {
  const { route, go, director, startScenario, stepScenario, stopScenario } = useApp();
  const { data: stored, reload } = useApi<Storyline[]>('/storylines');
  const storylines = useMemo(() => mergeStorylines(stored), [stored]);
  const [present, setPresent] = useState<PresentState | null>(() => { try { const s = sessionStorage.getItem(STORE); return s ? { view: 'stage', activityFloor: 0, ...JSON.parse(s), tally: null } : null; } catch { return null; } });
  const [busy, setBusy] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const storyline = useMemo(() => (present ? storylines.find((s) => s.id === present.storylineId) ?? null : null), [present, storylines]);
  const items = useMemo(() => (storyline ? expand(storyline) : []), [storyline]);
  const item = present && items.length ? items[Math.min(present.index, items.length - 1)] : null;
  const directorRef = useRef(director); directorRef.current = director;

  // Persist the place in the storyline, so a reload in the meeting room comes back to the same chapter.
  useEffect(() => { try { if (present) sessionStorage.setItem(STORE, JSON.stringify({ storylineId: present.storylineId, index: present.index, floor: present.floor, activityFloor: present.activityFloor, startedAt: present.startedAt, elapsedMs: present.elapsedMs, view: present.view })); else sessionStorage.removeItem(STORE); } catch { /* */ } }, [present]);
  // After a reload we have no Director: a scenario item cannot be resumed, so land on the card before it.
  useEffect(() => { if (present && items.length && !director && items[present.index]?.type === 'scenario' && present.index > 0 && !busy) setPresent((p) => p && { ...p, index: p.index - 1 }); }, [items, present, director, busy]);

  const start = useCallback((storylineId: string) => {
    setPresent((p) => (p && p.storylineId === storylineId ? p : { storylineId, index: 0, floor: 0, activityFloor: 0, startedAt: 0, tally: null, elapsedMs: 0, view: 'stage' }));
    if (route.screen !== 'present') go('present', storylineId);
  }, [route.screen, go]);
  // #/present/<storyline> enters Present mode (and is where the cards live in the URL).
  useEffect(() => { if (route.screen === 'present') start(route.param ?? DEFAULT_STORYLINES[0].id); }, [route.screen, route.param, start]);

  const exit = useCallback(() => {
    if (directorRef.current) stopScenario();
    setPresent(null);
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    go('scenarios');
  }, [stopScenario, go]);

  const beginScenario = useCallback(async (index: number, key: string) => {
    setBusy(true);
    try {
      if (directorRef.current) stopScenario();
      const { id: floor, activity } = await api<{ id: number; activity: number }>('/trail/floor');
      setPresent((p) => p && { ...p, index, floor, activityFloor: activity ?? 0, startedAt: Date.now(), tally: null, elapsedMs: 0 });
      await startScenario(key);
    } finally { setBusy(false); }
  }, [startScenario, stopScenario]);

  const goTo = useCallback((index: number) => {
    if (!present) return;
    const i = Math.max(0, Math.min(items.length - 1, index));
    const target = items[i];
    if (!target) return;
    if (target.type === 'scenario') { beginScenario(i, target.chapter.scenario); return; }
    if (target.type === 'interlude') { goTo(i - 1); return; }
    if (directorRef.current) stopScenario();
    setPresent((p) => p && { ...p, index: i });
    if (route.screen !== 'present') go('present', present.storylineId);
  }, [present, items, beginScenario, stopScenario, route.screen, go]);

  const next = useCallback(async () => {
    if (!present || !item || busy) return;
    if (item.type === 'scenario') {
      const d = directorRef.current;
      if (!d) { beginScenario(present.index, item.chapter.scenario); return; }
      if (d.busy) return;
      if (d.status === 'running') { stepScenario(1); return; }
      // The scenario is done: count what it did and show the interlude. The Director stays alive behind the card, so Back returns to its last step.
      setBusy(true);
      try {
        const tally = await api<Tally>(`/trail/tally?after=${present.floor}`);
        setPresent((p) => p && { ...p, index: p.index + 1, tally, elapsedMs: Date.now() - p.startedAt });
        go('present', present.storylineId);
      } finally { setBusy(false); }
      return;
    }
    const ni = present.index + 1;
    if (ni >= items.length) return;
    const target = items[ni];
    if (target.type === 'scenario') { beginScenario(ni, target.chapter.scenario); return; }
    if (directorRef.current) stopScenario();
    setPresent((p) => p && { ...p, index: ni });
  }, [present, item, busy, items, beginScenario, stepScenario, stopScenario, go]);

  const prev = useCallback(() => {
    if (!present || !item || busy) return;
    const d = directorRef.current;
    if (item.type === 'scenario' && d) {
      if (d.busy) return;
      if (d.index > 0) { stepScenario(-1); return; }
      stopScenario(); setPresent((p) => p && { ...p, index: Math.max(0, p.index - 1) }); go('present', present.storylineId); return;
    }
    if (item.type === 'interlude' && d) {
      // Back into the scenario's last step; the Director is still there.
      setPresent((p) => p && { ...p, index: p.index - 1 });
      const st = d.steps[d.index]; if (st?.screenResolved) { const i = st.screenResolved.indexOf(':'); go(i < 0 ? st.screenResolved : st.screenResolved.slice(0, i), i < 0 ? null : st.screenResolved.slice(i + 1)); }
      return;
    }
    if (present.index === 0) return;
    let pi = present.index - 1;
    if (items[pi]?.type === 'interlude') pi -= 1; // a finished scenario cannot be re-shown without re-running it
    if (items[pi]?.type === 'scenario') pi -= 1;
    setPresent((p) => p && { ...p, index: Math.max(0, pi) });
  }, [present, item, busy, items, stepScenario, stopScenario, go]);

  const toggleFullscreen = useCallback(() => { if (document.fullscreenElement) document.exitFullscreen().catch(() => {}); else document.documentElement.requestFullscreen().catch(() => {}); }, []);
  useEffect(() => { const on = () => setFullscreen(!!document.fullscreenElement); document.addEventListener('fullscreenchange', on); return () => document.removeEventListener('fullscreenchange', on); }, []);

  // Keyboard: → / space / PageDown next · ← / PageUp back · Esc leave · F full screen. Not while typing.
  useEffect(() => {
    if (!present) return;
    const on = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
      if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown') { e.preventDefault(); next(); }
      else if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); prev(); }
      else if (e.key === 'Escape') { if (!document.fullscreenElement) exit(); }
      else if (e.key === 'f' || e.key === 'F') { toggleFullscreen(); }
    };
    window.addEventListener('keydown', on);
    return () => window.removeEventListener('keydown', on);
  }, [present, next, prev, exit, toggleFullscreen]);

  // Larger type for the room while presenting.
  useEffect(() => { document.documentElement.classList.toggle('presenting', !!present); return () => document.documentElement.classList.remove('presenting'); }, [present]);

  const setView = useCallback((v: PresentView) => setPresent((p) => p && { ...p, view: v }), []);
  const value = useMemo<PresentCtx>(() => ({ present, storylines, storyline, items, item, start, exit, next, prev, goTo, fullscreen, toggleFullscreen, busy, reloadStorylines: reload, setView }), [present, storylines, storyline, items, item, start, exit, next, prev, goTo, fullscreen, toggleFullscreen, busy, reload, setView]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
export function usePresent(): PresentCtx { const c = useContext(Ctx); if (!c) throw new Error('usePresent outside PresentProvider'); return c; }

// ------------------------------------------------------------------ live numbers
function useTokens() {
  const { session } = useApp();
  const { data: h } = useApi<any>('/health');
  return useCallback((s: string) => {
    if (!h) return s.replace(/\{[a-zA-Z]+\}/g, '…');
    const curable = (h.curable?.classA ?? 0) + (h.curable?.classB ?? 0);
    const map: Record<string, string> = {
      customers: num(h.customers), eligible: num(h.eligible), eligibleRate: pct(h.eligibleRate), fallouts: num(h.fallouts), curable: num(curable),
      curablePct: pct((100 * curable) / Math.max(1, h.fallouts ?? 1), 0), classA: num(h.curable?.classA), classB: num(h.curable?.classB),
      policyVersion: String(session?.policyVersion ?? ''), today: session?.clock.today ?? '',
    };
    return s.replace(/\{([a-zA-Z]+)\}/g, (m, k) => map[k] ?? m);
  }, [h, session]);
}

// ------------------------------------------------------------------ the full-screen card
export function PresentOverlay() {
  const { present, storyline, items, item, next, prev, exit, goTo, fullscreen, toggleFullscreen, busy } = usePresent();
  const { session } = useApp();
  const fill = useTokens();
  const { data: sc } = useApi<any>('/scenarios');
  if (!present || !storyline || !item || item.type === 'scenario') return null;
  const scenarios: any[] = sc?.scenarios ?? [];
  const n = present.index;
  const scenarioOf = (key: string) => scenarios.find((s) => s.key === key);
  return (
    <div className="page-hero present-overlay fixed inset-0 z-[70] flex flex-col" style={{ background: 'linear-gradient(135deg, hsl(var(--hero-background)) 0%, hsl(var(--hero-card)) 100%)' }}>
      <div className="flex items-center justify-between px-10 pt-8">
        <div className="flex items-center gap-3"><img src="/brand/mark-on-dark.png" alt="" className="h-9 w-9" /><span className="text-lg font-semibold tracking-tight">Jahiz</span><span className="text-sm text-muted-foreground">· {storyline.name}</span></div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">{session ? <span className="font-mono">{session.clock.today}</span> : null}<button type="button" onClick={toggleFullscreen} title={fullscreen ? 'Leave full screen (F)' : 'Full screen (F)'} className="rounded-full border border-border/60 p-2 hover:bg-white/10">{fullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}</button><button type="button" onClick={exit} title="Leave Present mode (Esc)" className="rounded-full border border-border/60 p-2 hover:bg-white/10"><X className="h-4 w-4" /></button></div>
      </div>
      <div key={n} className="present-enter flex flex-1 flex-col justify-center px-10 pb-6 pt-4 md:px-16 lg:px-24">
        {item.type === 'card' ? <Card card={item.chapter} fill={fill} storyline={storyline} scenarioOf={scenarioOf} /> : <Interlude chapter={item.chapter} tally={present.tally} elapsedMs={present.elapsedMs} scenario={scenarioOf(item.chapter.scenario)} />}
      </div>
      <div className="flex items-center justify-between px-10 pb-7">
        <div className="flex items-center gap-1.5">{items.map((it, i) => <button key={i} type="button" onClick={() => goTo(i)} title={it.type === 'card' ? it.chapter.title : `${it.chapter.scenario}${it.type === 'interlude' ? ' · what you saw' : ''}`} className={cn('h-1.5 rounded-full transition-all', i === n ? 'w-7 bg-primary' : it.type === 'scenario' ? 'w-3.5 bg-white/45 hover:bg-white/70' : 'w-1.5 bg-white/30 hover:bg-white/60')} />)}</div>
        <div className="flex items-center gap-3 text-[12px] text-muted-foreground"><span className="hidden sm:inline">← → to move · F full screen · Esc to leave</span>
          <button type="button" onClick={prev} disabled={n === 0 || busy} className="rounded-full border border-border/60 p-2 hover:bg-white/10 disabled:opacity-40"><ChevronLeft className="h-4 w-4" /></button>
          <button type="button" onClick={next} disabled={n >= items.length - 1 || busy} className="rounded-full bg-primary p-2 text-primary-foreground hover:opacity-90 disabled:opacity-40">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ChevronRight className="h-4 w-4" />}</button>
        </div>
      </div>
    </div>
  );
}

function Card({ card, fill, storyline, scenarioOf }: { card: CardChapter; fill: (s: string) => string; storyline: Storyline; scenarioOf: (k: string) => any }) {
  const lines = card.lines.map(fill);
  return (
    <div className="mx-auto w-full max-w-[1180px]">
      {card.eyebrow ? <p className="eyebrow text-[12px]">{fill(card.eyebrow)}</p> : null}
      <h1 className="headline-xl mt-4 max-w-[1000px]">{fill(card.title)}</h1>
      {card.layout === 'statement' ? <div className="mt-8 max-w-[860px] space-y-4">{lines.map((l, i) => <p key={i} className={cn('text-xl leading-relaxed md:text-2xl', i === lines.length - 1 && lines.length > 1 ? 'text-primary' : 'text-foreground/90')}>{l}</p>)}</div> : null}
      {card.layout === 'steps' ? (
        <ol className="mt-8 grid max-w-[1100px] gap-x-10 gap-y-4 md:grid-cols-2">{lines.map((l, i) => <li key={i} className="flex items-start gap-4"><span className="mt-0.5 w-8 shrink-0 font-mono text-2xl text-primary">{i + 1}</span><span className="text-lg leading-snug md:text-xl">{l}</span></li>)}</ol>
      ) : null}
      {card.layout === 'columns' ? <Columns lines={lines} /> : null}
      {card.layout === 'agenda' ? (
        <>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {storyline.chapters.filter((c): c is ScenarioChapter => c.kind === 'scenario').map((c) => { const s = scenarioOf(c.scenario); return (
              <div key={c.id} className="rounded-2xl border border-border/60 bg-white/5 p-5">
                <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-primary">{c.scenario} · {s?.shape ?? ''}</p>
                <p className="mt-2 text-xl font-semibold leading-tight">{s?.name ?? c.scenario}</p>
                <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">{s?.summary ?? ''}</p>
                {c.audience ? <p className="mt-3 text-[12px] text-muted-foreground">For {c.audience}</p> : null}
              </div>); })}
          </div>
          {lines.length ? <p className="mt-6 text-lg text-foreground/80">{lines[0]}</p> : null}
        </>
      ) : null}
    </div>
  );
}

function Columns({ lines }: { lines: string[] }) {
  const cols: { title: string; lines: string[] }[] = [];
  for (const l of lines) { if (l.startsWith('## ')) cols.push({ title: l.slice(3), lines: [] }); else if (cols.length) cols[cols.length - 1].lines.push(l); else cols.push({ title: '', lines: [l] }); }
  return (
    <div className={cn('mt-8 grid gap-6', cols.length >= 3 ? 'md:grid-cols-3' : cols.length === 2 ? 'md:grid-cols-2' : '')}>
      {cols.map((c, i) => (
        <div key={i} className="rounded-2xl border border-border/60 bg-white/5 p-5">
          {c.title ? <p className="text-xl font-semibold text-primary">{c.title}</p> : null}
          <ul className="mt-3 space-y-2.5">{c.lines.map((l, j) => <li key={j} className="flex gap-3 text-[15px] leading-relaxed"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />{l}</li>)}</ul>
        </div>
      ))}
    </div>
  );
}

function Interlude({ chapter, tally, elapsedMs, scenario }: { chapter: ScenarioChapter; tally: Tally | null; elapsedMs: number; scenario: any }) {
  const { director } = useApp();
  const steps = director?.steps.length ?? scenario?.steps?.length ?? 0;
  const mins = Math.max(1, Math.round(elapsedMs / 60000));
  const one = (n: number, w: string) => `${num(n)} ${w}${n === 1 ? '' : 's'}`;
  const facts = tally ? [
    `${one(tally.agent_actions, 'agent action')} by ${one(tally.agents, 'agent')}`,
    tally.examined ? `${one(tally.examined, 'document')} read and checked against the record` : null,
    tally.sent ? `${one(tally.sent, 'message')} sent to the customer` : null,
    tally.blocked ? `${one(tally.blocked, 'message')} stopped by the policy guard, ${tally.blocked === 1 ? 'with its clause' : 'each with its clause'}` : null,
    `${one(tally.record_writes, 'record change')}, ${tally.record_writes === 1 ? 'approved by a person first' : 'each approved by a person first'}`,
    tally.requalified ? `${one(tally.requalified, 'customer')} re-qualified` : null,
    tally.offers ? `${one(tally.offers, 'offer')} handed back to the app` : null,
    tally.overrides ? `${one(tally.overrides, 'decision')} taken against the recommendation, with a reason` : null,
  ].filter(Boolean) as string[] : [];
  return (
    <div className="mx-auto w-full max-w-[1180px]">
      <p className="eyebrow text-[12px]">What you just saw · {chapter.scenario} · {scenario?.name ?? ''}</p>
      <h1 className="headline-xl mt-4 max-w-[1000px]">{steps ? `${one(steps, 'step')}, ` : ''}{tally ? one(tally.human_decisions, 'human decision') : '…'}, {mins} minute{mins === 1 ? '' : 's'}.</h1>
      <div className="mt-8 grid max-w-[1000px] gap-x-10 gap-y-3 md:grid-cols-2">{facts.map((f, i) => <p key={i} className="text-lg leading-snug md:text-xl">{f}</p>)}</div>
      {chapter.question ? <p className="mt-10 text-2xl text-primary md:text-3xl">{chapter.question}</p> : null}
    </div>
  );
}

// ------------------------------------------------------------------ the slim title bar while a scenario runs
export function PresentBar({ user }: { user?: ReactNode }) {
  const { present, storyline, items, item, next, prev, exit, busy, setView } = usePresent();
  const { session, director, setAuto } = useApp();
  if (!present || !storyline || !item) return null;
  const sc = item.type !== 'card' ? item.chapter : null;
  const speed = director ? Math.round(9000 / (director.autoMs || 9000)) : 1;
  return (
    <div className="glass-chrome flex h-14 items-center gap-3 rounded-xl px-4 shadow-lg">
      <div className="flex items-center gap-2"><img src="/brand/mark.png" alt="" className="h-7 w-7 dark:hidden" /><img src="/brand/mark-on-dark.png" alt="" className="hidden h-7 w-7 dark:block" /><span className="text-base font-semibold">Jahiz</span><Chip tone="warn">Present</Chip></div>
      <div className="min-w-0 flex-1 truncate text-[13px] text-muted-foreground">
        <span className="font-mono text-accent">{sc?.scenario}</span> {director ? <>· {director.name} · step {Math.max(0, director.index) + 1} of {director.steps.length}{director.status === 'done' ? ' · complete, → for what you saw' : ''}</> : <>· starting…</>}
        <span className="ms-3 hidden xl:inline">chapter {present.index + 1} of {items.length}</span>
      </div>
      {session ? <span className="hidden items-center gap-2 rounded-full border border-border/70 bg-card/50 px-3 py-1.5 font-mono text-[12px] lg:flex">{session.clock.today}{session.clock.virtual ? <Chip tone="warn">virtual</Chip> : null}</span> : null}
      {director ? (
        <div className="hidden items-center gap-1 rounded-full border border-border/70 bg-card/50 p-1 md:flex" title="Auto-play speed">
          {[1, 2, 4].map((x) => <button key={x} type="button" onClick={() => setAuto(director.auto, 9000 / x)} className={cn('rounded-full px-2 py-0.5 font-mono text-[11px]', speed === x ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground')}>{x}×</button>)}
        </div>
      ) : null}
      <div className="hidden items-center gap-1 rounded-full border border-border/70 bg-card/50 p-1 md:flex" title="Stage: the customer, the agents and the bank side by side. App: the product's own screens.">
        {(['stage', 'app'] as const).map((v) => <button key={v} type="button" onClick={() => setView(v)} className={cn('rounded-full px-2.5 py-0.5 text-[11px] font-medium', present.view === v ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground')}>{v === 'stage' ? 'Stage' : 'App'}</button>)}
      </div>
      <div className="flex items-center gap-1.5">
        <Btn small onClick={prev} disabled={busy || director?.busy} title="Back (←)"><ChevronLeft className="h-3.5 w-3.5" /></Btn>
        <Btn small kind="primary" onClick={next} disabled={busy || director?.busy} title="Next (→)">{busy || director?.busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ChevronRight className="h-3.5 w-3.5" />}</Btn>
        {director ? <Btn small onClick={() => setAuto(!director.auto)} disabled={director.status === 'done'} title={director.auto ? 'Pause auto-play' : `Auto-play (${Math.round((director.autoMs || 9000) / 1000)} s per step)`}>{director.auto ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}</Btn> : null}
        <Btn small onClick={exit} title="Leave Present mode (Esc)"><X className="h-3.5 w-3.5" /></Btn>
      </div>
      {user}
    </div>
  );
}

// ------------------------------------------------------------------ Settings → Demo: the storyline editor
export function StorylineEditor() {
  const { storylines, reloadStorylines } = usePresent();
  const { go } = useApp();
  const { data: sc } = useApi<any>('/scenarios');
  const [draft, setDraft] = useState<Storyline[] | null>(null);
  const [sel, setSel] = useState(0);
  const [openId, setOpenId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false); const [msg, setMsg] = useState('');
  const list = draft ?? storylines;
  const s = list[Math.min(sel, list.length - 1)];
  const scenarios: any[] = sc?.scenarios ?? [];
  const update = (fn: (st: Storyline) => Storyline) => setDraft(list.map((x, i) => (i === sel ? fn(x) : x)));
  const setChapters = (chs: Chapter[]) => update((st) => ({ ...st, chapters: chs }));
  const move = (i: number, d: -1 | 1) => { const c = [...s.chapters]; const j = i + d; if (j < 0 || j >= c.length) return; [c[i], c[j]] = [c[j], c[i]]; setChapters(c); };
  const newId = () => `c${Date.now().toString(36)}`;
  const save = async () => { setSaving(true); try { await api('/storylines', { method: 'PUT', json: list }); setMsg('Saved. Present mode uses this storyline from its next start.'); setDraft(null); reloadStorylines(); } catch (e: any) { setMsg(`Not saved: ${e.message}`); } finally { setSaving(false); } };
  if (!s) return null;
  return (
    <div className="space-y-3">
      {msg ? <Note>{msg}</Note> : null}
      <div className="flex flex-wrap items-center gap-2">
        {list.map((st, i) => <button key={st.id} type="button" onClick={() => { setSel(i); setOpenId(null); }} className={cn('mono-chip', i === sel && 'is-primary')}>{st.name}</button>)}
        <Btn small onClick={() => { setDraft([...list, { id: newId(), name: 'New storyline', chapters: [] }]); setSel(list.length); }}><Plus className="h-3.5 w-3.5" /> New storyline</Btn>
        <span className="flex-1" />
        <Btn small kind="primary" onClick={() => go('present', s.id)}><Play className="h-3.5 w-3.5" /> Present this storyline</Btn>
      </div>
      <div className="grid gap-3 md:grid-cols-[1fr_auto]">
        <Field label="Storyline name"><input className="input" value={s.name} onChange={(e) => update((st) => ({ ...st, name: e.target.value }))} /></Field>
        <div className="flex items-end gap-2">
          <Btn small onClick={() => setChapters([...s.chapters, { kind: 'card', id: newId(), layout: 'statement', eyebrow: '', title: 'A claim, the way you would say it', lines: ['One sentence under it.'] }])}><Plus className="h-3.5 w-3.5" /> Card</Btn>
          <Btn small onClick={() => setChapters([...s.chapters, { kind: 'scenario', id: newId(), scenario: scenarios[0]?.key ?? 'S1', audience: '', question: 'Who in this room would have clicked approve?' }])}><Plus className="h-3.5 w-3.5" /> Scenario</Btn>
        </div>
      </div>
      <ol className="divide-y divide-border/60 rounded-xl border border-border/70">
        {s.chapters.map((c, i) => (
          <li key={c.id} className="p-2.5">
            <div className="flex items-center gap-2">
              <span className="w-6 font-mono text-[11px] text-muted-foreground">{i + 1}</span>
              <Chip tone={c.kind === 'scenario' ? 'primary' : undefined}>{c.kind === 'scenario' ? c.scenario : c.layout}</Chip>
              <button type="button" onClick={() => setOpenId(openId === c.id ? null : c.id)} className="min-w-0 flex-1 truncate text-start text-sm hover:text-primary">{c.kind === 'card' ? c.title : `${scenarios.find((x) => x.key === c.scenario)?.name ?? c.scenario}${c.audience ? ` · for ${c.audience}` : ''}`}</button>
              <Btn small onClick={() => move(i, -1)} disabled={i === 0} title="Move up"><ArrowUp className="h-3.5 w-3.5" /></Btn>
              <Btn small onClick={() => move(i, 1)} disabled={i === s.chapters.length - 1} title="Move down"><ArrowDown className="h-3.5 w-3.5" /></Btn>
              <Btn small kind="danger" onClick={() => setChapters(s.chapters.filter((_, j) => j !== i))} title="Remove"><Trash2 className="h-3.5 w-3.5" /></Btn>
            </div>
            {openId === c.id ? (
              <div className="mt-3 grid gap-3 ps-8 md:grid-cols-2">
                {c.kind === 'card' ? <>
                  <Field label="Layout"><Select value={c.layout} onChange={(v) => setChapters(s.chapters.map((x, j) => (j === i ? { ...c, layout: v as CardLayout } : x)))}><option value="statement">Statement · a claim and up to three sentences</option><option value="steps">Steps · a numbered list</option><option value="columns">Columns · lines starting with "## " open a column</option><option value="agenda">Agenda · the storyline's scenarios as tiles</option></Select></Field>
                  <Field label="Eyebrow (small line above the claim)"><input className="input" value={c.eyebrow ?? ''} onChange={(e) => setChapters(s.chapters.map((x, j) => (j === i ? { ...c, eyebrow: e.target.value } : x)))} /></Field>
                  <div className="md:col-span-2"><Field label="The claim (the headline, as a person would say it)"><input className="input" value={c.title} onChange={(e) => setChapters(s.chapters.map((x, j) => (j === i ? { ...c, title: e.target.value } : x)))} /></Field></div>
                  <div className="md:col-span-2"><Field label={`Lines, one per line · live tokens: ${TOKENS.join(' ')}`}><textarea className="input min-h-[120px] font-sans" value={c.lines.join('\n')} onChange={(e) => setChapters(s.chapters.map((x, j) => (j === i ? { ...c, lines: e.target.value.split('\n') } : x)))} /></Field></div>
                </> : <>
                  <Field label="Scenario"><Select value={c.scenario} onChange={(v) => setChapters(s.chapters.map((x, j) => (j === i ? { ...c, scenario: v } : x)))}>{scenarios.map((x) => <option key={x.key} value={x.key}>{x.key} · {x.name}</option>)}</Select></Field>
                  <Field label="For whom in the room (shown on the agenda card)"><input className="input" value={c.audience ?? ''} onChange={(e) => setChapters(s.chapters.map((x, j) => (j === i ? { ...c, audience: e.target.value } : x)))} /></Field>
                  <div className="md:col-span-2"><Field label="The question to the room after it (on the interlude card)"><input className="input" value={c.question ?? ''} onChange={(e) => setChapters(s.chapters.map((x, j) => (j === i ? { ...c, question: e.target.value } : x)))} /></Field></div>
                </>}
              </div>
            ) : null}
          </li>
        ))}
        {!s.chapters.length ? <li className="p-4 text-sm text-muted-foreground">No chapters yet. Add a card or a scenario.</li> : null}
      </ol>
      <div className="flex flex-wrap items-center gap-2">
        <Btn kind="primary" disabled={saving || !draft} onClick={save}>{saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null} Save</Btn>
        <Btn disabled={!draft} onClick={() => { setDraft(null); setMsg(''); }}>Discard changes</Btn>
        <Btn onClick={() => { const d = DEFAULT_STORYLINES.find((x) => x.id === s.id); if (d) update(() => d); }} disabled={!DEFAULT_STORYLINES.some((x) => x.id === s.id)} title="Put the shipped QIB storyline back (then Save)">Reset to the shipped storyline</Btn>
        {list.length > 1 ? <Btn kind="danger" onClick={() => { setDraft(list.filter((_, i) => i !== sel)); setSel(0); }} disabled={DEFAULT_STORYLINES.some((x) => x.id === s.id)} title="Only added storylines can be removed">Remove storyline</Btn> : null}
        <span className="text-[12px] text-muted-foreground">A scenario chapter is followed by an interlude card with the numbers counted from the trail.</span>
      </div>
    </div>
  );
}

