/**
 * The case, decision first (SCREEN-DISCIPLINE rules 1–7): a meta line, a
 * headline that says what stands between this customer and the offer, up to
 * three facts each with its picture, the recommendation with its exception in
 * one line, and the decision. The proof — documents, messages, the workflow
 * step by step, the trail, the ids — is behind CogniPulse's <Provenance>,
 * closed. The Inbox reader and the case drawer are this one component.
 */
import { useState, type ReactNode } from 'react';
import { DecisionBar, DecisionTrail, InboxReader, Provenance, ReaderSection, TrailEntry, type TrailKind } from '@cognirise/cognipulse/archetypes';
import { Sheet, SheetContent, SheetTitle } from '@cognirise/cognipulse/components/ui/sheet';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@cognirise/cognipulse/components/ui/dropdown-menu';
import { CapBar, Dots, FigureTile, Segments } from '@cognirise/cognipulse/viz';
import { CheckCircle2, CircleDashed, Clock, Loader2, XCircle, Hourglass, ChevronDown } from 'lucide-react';
import { bump, post, useApi } from '../lib/api';
import { date, dateTime, num, qar, rel, title } from '../lib/format';
import { useApp, useFlash } from './state';
import { usePresent } from './present';
import { gapReason, monthName } from './plain';
import { AgentTag, Btn, Chip, Clause, Empty, ReasonChip, SEG, StatusChip, Table, DOC_LABEL, NOTE_LABEL, PERSONA_SHORT, REASON_LABEL } from './ui';
import { CaseClock, Confidence, Headroom, RuleDots, SalaryColumns } from './viz';

export const KIND: Record<string, TrailKind> = {
  SCAN: 'observed', OPEN_CASE: 'acted', UPDATE_CASE: 'observed', PLAN: 'proposed', SEND: 'acted', SEND_NOW: 'acted', BLOCK: 'rejected', DEFER: 'observed', ALLOW: 'observed', RECEIVE: 'observed', CLASSIFY: 'observed', ROUTE: 'acted', EXAMINE: 'proposed', WRITE: 'acted', REQUALIFY: 'acted', HANDOFF: 'acted',
  APPROVE: 'approved', REJECT: 'rejected', RETURN: 'rejected', OVERRIDE: 'overridden', ESCALATE: 'escalated', TIMEOUT: 'escalated', BRIEF: 'proposed', TASK: 'proposed', PROPOSE: 'proposed', PREVIEW: 'proposed', VERSION: 'approved', REPLAN: 'acted', ANSWER: 'acted', CONFIRM: 'approved',
  PAUSE: 'escalated', RESUME: 'acted', SCHEDULE: 'observed', SUPPRESS: 'observed', RECORD: 'observed', QUEUE: 'proposed', ANALYSE: 'observed', EMPLOYER_PACK: 'proposed', FLAG: 'rejected', OFFER: 'proposed', TASK_DONE: 'approved', CORE_EVENT: 'observed', KEEP_PAUSED: 'rejected', CLOSE: 'acted', RESCHEDULE: 'acted', ACCEPT: 'approved',
};

/** What a waiting run asks of the person, as a question they would ask themselves. */
export function askOf(a: { action_type?: string; payload?: any; result?: any } | null | undefined): string {
  const action = a?.action_type ?? a?.result?.actionType ?? a?.payload?.actionType ?? 'DECIDE';
  switch (action) {
    case 'DECIDE_RESTRICTION': return 'Restrict the cards, or keep trying?';
    case 'DECIDE_EMPLOYER': return 'Approve the employer?';
    case 'CLEAR_CAUTIONARY_NOTE': return `Clear the ${NOTE_LABEL[a?.payload?.noteType] ?? 'cautionary'} note?`;
    case 'RESUME_CASE': return a?.payload?.kind === 'HARDSHIP' ? 'Resume outreach after a hardship reply?' : a?.payload?.kind === 'COMPLAINT' ? 'Resume outreach after a complaint?' : 'Resume outreach?';
    case 'COLLECTIONS_CADENCE_EXCEPTION': return 'Acknowledge the hand-off to Collections';
    case 'APPROVE_UPDATE': return 'Approve the record update?';
    case 'ACCEPT_EXPLAINED_GAP': return 'Accept the explained salary gap?';
    case 'APPROVE_HANDOFF': return 'Hand the offer to One Click?';
    case 'APPROVE_POLICY_CHANGE': return 'Approve the policy change?';
    case 'ADD_DNC': return 'Add to the do-not-contact list?';
    case 'ESCALATE_TO_RM': return 'Record the outcome of the contact';
    case 'RESOLVE_FAILURE': return 'Resume or close the failed run?';
    default: return a?.payload?.route === 'COMPLIANCE' ? 'Lift the frozen or closed status, or keep it?' : a?.payload?.route === 'DORMANT' ? 'Reactivate the dormant account?' : title(action);
  }
}

export function TrailList({ rows, compact }: { rows: any[]; compact?: boolean }) {
  const { go, session } = useApp();
  if (!rows.length) return <Empty>No activity yet.</Empty>;
  return (
    <DecisionTrail>
      {rows.map((e) => (
        <TrailEntry key={e.id} kind={KIND[e.act] ?? 'observed'}
          actor={e.actor_type === 'AGENT' || (e.actor_type === 'SYSTEM' && e.actor_id === 'muhaddith') ? <AgentTag id={e.actor_id} showChip={false} /> : <span className="text-sm font-medium">{e.actor_name}</span>}
          autonomy={e.autonomy ? <Chip>{e.autonomy}</Chip> : e.policy_version ? <Chip>v{e.policy_version}</Chip> : null}
          at={compact ? rel(e.at, session?.clock.now) : dateTime(e.at)}
          summary={e.summary}
          detail={e.clause || e.evidence_ref || (e.before || e.after) ? <span className="flex flex-wrap items-center gap-2 font-mono text-[11px]">{e.clause ? <Clause id={e.clause} onClick={(id) => go('policies', id.split(' ')[0])} /> : null}{e.policy_version ? <span className="text-muted-foreground">policy v{e.policy_version}</span> : null}{e.before || e.after ? <span className="text-muted-foreground">{e.before ? `before ${JSON.stringify(e.before)}` : ''} {e.after ? `after ${JSON.stringify(e.after)}` : ''}</span> : null}</span> : undefined}
          override={e.override ? { from: 'Agent recommendation', to: 'Human decision', reason: e.reason } : undefined} />
      ))}
    </DecisionTrail>
  );
}

function StepIcon({ s }: { s: string }) {
  if (s === 'DONE') return <CheckCircle2 className="h-4 w-4 text-success" />;
  if (s === 'WAITING') return <Clock className="h-4 w-4 text-warn" />;
  if (s === 'WAITING_EVENT') return <Hourglass className="h-4 w-4 text-primary" />;
  if (s === 'REFUSED' || s === 'FAILED') return <XCircle className="h-4 w-4 text-danger" />;
  if (s === 'RUNNING') return <Loader2 className="h-4 w-4 animate-spin text-primary" />;
  return <CircleDashed className="h-4 w-4 text-muted-foreground" />;
}
export function Steps({ steps }: { steps: any[] }) {
  return (
    <ol className="space-y-1">
      {steps.map((s) => (
        <li key={s.id} className="flex items-start gap-3 rounded-lg px-2 py-1">
          <span className="mt-0.5"><StepIcon s={s.status} /></span>
          <div className="min-w-0 flex-1">
            <p className="flex flex-wrap items-center gap-2 text-sm"><span className={s.status === 'SKIPPED' ? 'text-muted-foreground line-through' : ''}>{s.label}</span>{s.actor_type === 'HUMAN' ? <Chip>{PERSONA_SHORT[s.actor_id] ?? s.actor_id.replace('approver:', 'approver: ')}</Chip> : <AgentTag id={s.actor_id} showChip={false} size={16} />}{s.actor_type === 'SYSTEM' ? <Chip>writes the record</Chip> : null}</p>
            {s.decision ? <p className="text-[12px] text-muted-foreground">{s.decision}</p> : null}
          </div>
          <span className="shrink-0 text-[11px] text-muted-foreground">{s.ended_at ? dateTime(s.ended_at) : s.started_at ? dateTime(s.started_at) : ''}</span>
        </li>
      ))}
    </ol>
  );
}

export function Messages({ rows, compact }: { rows: any[]; compact?: boolean }) {
  const { go, session } = useApp();
  if (!rows.length) return <Empty>No messages on this case.</Empty>;
  return (
    <Table>
      <thead><tr><th>When</th><th>Channel</th><th>Message</th><th>Status</th>{!compact ? <th>Policy</th> : null}</tr></thead>
      <tbody>{rows.map((m) => <MessageRow key={m.id} m={m} compact={compact} now={session?.clock.now} go={go} />)}</tbody>
    </Table>
  );
}
function MessageRow({ m, compact, now, go }: { m: any; compact?: boolean; now?: string; go: (s: string, p?: string | null) => void }) {
  const flash = useFlash('messages', m.id, true);
  const [openBody, setOpenBody] = useState(false);
  return (
    <>
      <tr className={`clickable ${flash}`} onClick={() => setOpenBody((o) => !o)}>
        <td className="whitespace-nowrap text-[12px]"><span className="block">{dateTime(m.sent_at ?? m.scheduled_for)}</span><span className="text-muted-foreground">{rel(m.sent_at ?? m.scheduled_for, now)}</span></td>
        <td><Chip>{m.channel}</Chip></td>
        <td><span className="block text-sm">{title(m.message_type)}{m.attempt ? <span className="text-muted-foreground"> · attempt {m.attempt}</span> : null}{m.marketing ? <Chip tone="warn" className="ms-1">offer</Chip> : null}</span><span className="block truncate text-[12px] text-muted-foreground" style={{ maxWidth: 420 }}>{m.subject}</span>{m.block_reason ? <span className="block text-[12px] text-danger">{m.block_reason} {m.block_clause ? <Clause id={m.block_clause} onClick={(id) => go('policies', id.split(' ')[0])} /> : null}</span> : null}{m.meta?.deferred ? <span className="block text-[12px] text-warn">Deferred {m.meta.deferred}× by the contact cap</span> : null}</td>
        <td><StatusChip status={m.status} /></td>
        {!compact ? <td className="text-[12px] text-muted-foreground">v{m.policy_version}{m.approved_by ? ` · approved by ${m.approved_by}` : ''}{m.window_used ? ` · ${m.window_used}` : ''}</td> : null}
      </tr>
      {openBody ? <tr><td colSpan={5} className="bg-muted/30"><div className={`whitespace-pre-wrap rounded-lg border border-border/60 bg-card/60 p-3 text-[13px] leading-relaxed ${m.lang === 'ar' ? 'ar text-end' : ''}`} dir={m.lang === 'ar' ? 'rtl' : 'ltr'}><p className="mb-1 font-semibold">{m.subject}</p>{m.body}</div></td></tr> : null}
    </>
  );
}

/** A proposed value in a person's words: a date as a date, a renewal as "valid to …", a gap reason spelled out. */
export const plainValue = (v: any, gap = false): string => {
  if (v === null || v === undefined || v === '') return '—';
  const str = String(v);
  try { const o = JSON.parse(str); if (o && typeof o === 'object') { const exp = o.expires_on ?? o['expires on'] ?? o.expiresOn ?? o.expires ?? o.expiry; if (exp) return `valid to ${date(exp)}`; return Object.entries(o).filter(([k]) => !/image|source|ref|number/i.test(k)).slice(0, 2).map(([k, x]) => `${k} ${x}`).join(', ') || 'updated'; } } catch { /* a plain value */ }
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return date(str);
  if (gap && /^[A-Z_]+$/.test(str)) return gapReason(str);
  return str.replace(/_/g, ' ').toLowerCase();
};
/** "QID expiry: 30 Sept 2026 → valid to 4 Oct 2029", or "salary July 2026: — → explained, a job change". */
export const plainProposal = (p: any): string => {
  const f = String(p.field ?? ''); const gap = p.target === 'salary_credits' && /^\d{4}-\d{2}$/.test(f);
  const name = gap ? `salary ${monthName(f)}` : f === 'renew' ? `${DOC_LABEL[String(p.target ?? '').toUpperCase()] ?? p.target} renewal` : String(p.field ?? p.target ?? '').split('.').slice(-2).join(' ').replace(/_/g, ' ');
  return `${name}: ${plainValue(p.old_value)} → ${gap ? `explained, ${plainValue(p.new_value, true)}` : plainValue(p.new_value)}`;
};

export function Proposals({ rows }: { rows: any[] }) {
  if (!rows.length) return null;
  return (
    <Table>
      <thead><tr><th>Field</th><th>Before</th><th>After</th><th>Confidence</th><th>State</th></tr></thead>
      <tbody>{rows.map((p) => { let after = p.new_value; try { if (p.field === 'renew') { const j = JSON.parse(p.new_value); after = `${j.number} · expires ${j.expires_on}`; } } catch { /* */ } return (
        <tr key={p.id}><td className="font-mono text-[12px]">{p.target}.{p.field}</td><td className="text-[12px]">{p.old_value ?? '—'}</td><td className="text-[12px] font-medium">{after}</td><td className="font-mono text-[12px]">{p.confidence ? Number(p.confidence).toFixed(2) : '—'}{p.one_click ? <Chip tone="success" className="ms-1">one-click</Chip> : null}</td><td><StatusChip status={p.state} />{p.decided_by ? <span className="block text-[11px] text-muted-foreground">{PERSONA_SHORT[p.decided_by] ?? p.decided_by}</span> : null}</td></tr>
      ); })}</tbody>
    </Table>
  );
}

/** The agent's one-line summary as a person would read it: codes, clause ids and month numbers spelled out or dropped. */
const plainSummary = (s: string) => String(s ?? '')
  .replace(/Explained gap (\d{4}-\d{2}): ([A-Z_]+)/g, (_m, ym, code) => `explained gap for ${monthName(ym)}: ${gapReason(code)}`)
  .replace(/\b(HR_LETTER|SALARY_CERT|QID|PASSPORT|LIABILITY_LETTER|SO_DECLARATION|BANK_STATEMENT)\b/g, (m) => ({ HR_LETTER: 'HR letter', SALARY_CERT: 'Salary certificate', QID: 'QID', PASSPORT: 'Passport', LIABILITY_LETTER: 'Liability letter', SO_DECLARATION: 'Standing-order declaration', BANK_STATEMENT: 'Bank statement' } as Record<string, string>)[m] ?? m)
  .replace(/\b(COURT_ATTACHMENT|SALARY_STOPPED|KYC_EXPIRED|SANCTIONS|FRAUD_AML|LEGAL_HOLD|DECEASED)\b/g, (m) => NOTE_LABEL[m] ?? m)
  .replace(/\b(?:POL|SEG|CH|REF|DATA)-?\d*\s*§\s*[\d.]+\s+(allows|requires|permits|says)\b/g, 'the policy $1')
  .replace(/\s*\(?\b(?:POL|SEG|CH|REF|DATA)-?\d*\s*§\s*[\d.]+\)?/g, '')
  .replace(/\bT\+(\d+)\b/g, '$1 days')
  .replace(/\bWF-\d+(?:\/\d+)?\b/g, 'its own workflow')
  .replace(/\b(R\d{2})\b/g, (m) => (REASON_LABEL[m] ?? m).toLowerCase())
  .replace(/customer\(s\)/g, 'customers')
  .replace(/\s{2,}/g, ' ')
  .replace(/([.!?]\s+)([a-z])/g, (_m, p: string, c: string) => p + c.toUpperCase());

/** Who prepared the recommendation, by what is being decided. */
const RECOMMENDER: Record<string, string> = { APPROVE_UPDATE: 'Fahis', ACCEPT_EXPLAINED_GAP: 'Fahis', DECIDE_EMPLOYER: 'Muwathiq', APPROVE_HANDOFF: 'Muahil', RESUME_CASE: 'Mustaqbil', DECIDE_RESTRICTION: 'Munadi', COLLECTIONS_CADENCE_EXCEPTION: 'Munabbih', CLEAR_CAUTIONARY_NOTE: 'Raqib', APPROVE_POLICY_CHANGE: 'Hami' };

/** The recommendation with its reason and its exception in one line (SCREEN-DISCIPLINE rule 7). */
export function Recommendation({ run, omitQuote }: { run: any; omitQuote?: boolean }) {
  const r = run?.result?.recommendation;
  if (!r) return null;
  // The customer's words are a fact on the card; the line does not repeat them (SCREEN-DISCIPLINE rule 2).
  const text = omitQuote ? String(r.summary ?? '').replace(/^Customer wrote: ".*?"\.\s*/s, '') : r.summary;
  const action = run?.result?.actionType ?? run?.payload?.actionType ?? '';
  const who = RECOMMENDER[action] ?? 'The agents';
  const tone = r.verdict === 'APPROVE' ? 'border-success' : r.verdict === 'DECLINE' ? 'border-danger' : 'border-warn';
  const verb = r.verdict === 'APPROVE' ? 'recommends approving.' : r.verdict === 'DECLINE' ? 'recommends declining.' : 'asks you to look.';
  return (
    <p className={`border-s-2 ps-3 text-sm leading-relaxed ${tone}`}>
      <span className="font-semibold">{who} {verb}</span> {plainSummary(text).trim().replace(/^[a-z]/, (c) => c.toUpperCase())}
    </p>
  );
}

/** The decision for a run waiting on the signed-in persona: the reversible option left of the irreversible one; a reason is asked for only when one is needed. */
export function Decide({ run, onDone, extra }: { run: any; onDone?: () => void; extra?: ReactNode }) {
  const [reason, setReason] = useState('');
  const [asking, setAsking] = useState<null | 'APPROVED' | 'REJECTED'>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [reclassify, setReclassify] = useState(false);
  const rec = run?.result?.recommendation;
  const action = run?.result?.actionType ?? run?.payload?.actionType ?? 'DECIDE';
  const labels: Record<string, [string, string]> = {
    APPROVE_UPDATE: ['Approve the update', 'Reject the document'], ACCEPT_EXPLAINED_GAP: ['Accept the explained gap', 'Reject the document'], DECIDE_EMPLOYER: ['Approve the employer', 'Decline the employer'], APPROVE_HANDOFF: ['Approve the hand-off', 'Hold the offer'],
    DECIDE_RESTRICTION: ['Approve the restriction', 'Keep trying'], CLEAR_CAUTIONARY_NOTE: [reclassify ? 'Lift and reclassify' : 'Clear the note', 'Keep the note'], APPROVE_POLICY_CHANGE: ['Approve the change', 'Decline the change'], COLLECTIONS_CADENCE_EXCEPTION: ['Acknowledge the hand-off', 'Send back'],
    RESUME_CASE: ['Resume automated outreach', 'Keep paused'], ADD_DNC: ['Add the DNC entry', 'Decline'], ESCALATE_TO_RM: ['Outcome recorded', 'Send back'], RESOLVE_FAILURE: ['Resume the run', 'Close the run'], DECIDE: ['Approve', 'Decline'],
  };
  const [ok, no] = labels[action] ?? (run?.payload?.route === 'COMPLIANCE' ? ['Lift the status', 'Keep it'] : run?.payload?.route === 'DORMANT' ? ['Approve the reactivation', 'Keep dormant'] : labels.DECIDE);
  // A reason is needed to decline, and to go against the recommendation either way.
  const needsReason = (decision: 'APPROVED' | 'REJECTED') => decision === 'REJECTED' || !!(rec && rec.verdict === 'DECLINE' && decision === 'APPROVED');
  const decide = async (decision: 'APPROVED' | 'REJECTED') => {
    if (needsReason(decision) && !reason.trim()) { setAsking(decision); setErr(''); return; }
    setBusy(true); setErr('');
    try { await post(`/runs/${run.id}/decide`, { decision, reason: reason.trim() || undefined, edits: reclassify ? { reclassify: true } : undefined }); bump(); onDone?.(); window.dispatchEvent(new CustomEvent('jahiz:action', { detail: { kind: 'decide', runId: run.id, action, decision } })); }
    catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  };
  return (
    <div className="space-y-2">
      {/* The question is a child, not DecisionBar's prompt: the prompt's flex basis is zero, so it folded word by word beside a named actions menu (a harvest for CogniPulse). */}
      <DecisionBar>
        <span className={`${extra ? 'w-full' : 'me-auto'} text-sm font-medium text-foreground`}>{askOf({ action_type: action, payload: run?.payload, result: run?.result })}</span>
        {extra ? <span className="me-auto">{extra}</span> : null}
        {action === 'CLEAR_CAUTIONARY_NOTE' ? <label className="flex items-center gap-1.5 text-[12px]"><input type="checkbox" checked={reclassify} onChange={(e) => setReclassify(e.target.checked)} /> reclassify to a workflow</label> : null}
        <Btn small onClick={() => decide('REJECTED')} disabled={busy}>{no}</Btn>
        <Btn small kind="primary" onClick={() => decide('APPROVED')} disabled={busy}>{busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}{ok}</Btn>
      </DecisionBar>
      {asking ? (
        <div className="flex items-center gap-2">
          <input autoFocus className="input flex-1" placeholder={asking === 'REJECTED' ? `Why: ${no.toLowerCase()}?` : 'Why go against the recommendation?'} value={reason} onChange={(e) => setReason(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && reason.trim()) decide(asking); }} />
          <Btn small kind="primary" disabled={busy || !reason.trim()} onClick={() => decide(asking)}>{asking === 'REJECTED' ? no : ok}</Btn>
        </div>
      ) : null}
      {err ? <p className="text-[12px] text-danger">{err}</p> : null}
    </div>
  );
}

// ------------------------------------------------------------------ the card
const daysBetween = (a: string | Date, b: string | Date) => Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000);
const addDays = (s: string, d: number) => new Date(new Date(s).getTime() + d * 86400000);
const first = (name: string) => String(name ?? '').split(' ')[0];
/** Lower-case a label for mid-sentence use without touching an acronym ("QID expired" stays). */
const lc = (s: string) => String(s ?? '').replace(/^[A-Z](?=[a-z])/, (c) => c.toLowerCase());

/** The headline: what stands between this customer and the offer, as a claim with the number in it. */
function headlineOf(d: any, waiting: any, now: string): string {
  const k = d.case; const f = d.facts; const name: string = k.name_en;
  const action = waiting?.result?.actionType ?? waiting?.payload?.actionType ?? (waiting ? 'DECIDE' : null);
  const summary: string = waiting?.result?.recommendation?.summary ?? '';
  const reason = REASON_LABEL[k.primary_reason] ?? k.primary_reason;
  const expiryDoc = k.primary_reason === 'R06' ? 'passport' : k.primary_reason === 'R07' ? 'QID' : null;
  const expiry = k.primary_reason === 'R06' ? f?.passportExpiry : k.primary_reason === 'R07' ? f?.qidExpiry : null;
  switch (action) {
    case 'DECIDE_RESTRICTION': { const days = expiry ? daysBetween(expiry, now) : null; return days !== null ? `${name} has not replied in the ${days} days since the ${expiryDoc} expired; a temporary card restriction waits on you` : `${name} has not replied to ${k.attempts} notices and a call; a temporary card restriction waits on you`; }
    case 'DECIDE_EMPLOYER': { const m = summary.match(/re-qualify those (\d+)/); const emp = f?.employerName ?? 'the employer'; return m ? `Approving ${emp} would re-qualify ${m[1]} customer${m[1] === '1' ? '' : 's'} tonight, ${first(name)} among them` : `${first(name)}'s employer, ${emp}, is not on the approved list`; }
    case 'CLEAR_CAUTIONARY_NOTE': { const note = NOTE_LABEL[waiting?.payload?.noteType] ?? 'cautionary'; const m = summary.match(/clear when "(.+?)" is met/); return m ? `A ${note} note keeps ${name} out of the offer; it clears on a ${lc(m[1])}` : /remediable/.test(summary) ? `A ${note} note keeps ${name} out of the offer; it can be worked as a salary case instead` : `A ${note} note keeps ${name} out of the offer`; }
    case 'RESUME_CASE': return `${name} wrote back ${waiting?.payload?.kind === 'HARDSHIP' ? 'in hardship' : waiting?.payload?.kind === 'COMPLAINT' ? 'with a complaint' : ''}; outreach stays paused until a person has spoken to them`;
    case 'COLLECTIONS_CADENCE_EXCEPTION': return `${name} is ${waiting?.payload?.dpd ?? f?.dpd ?? '—'} days past due; the case is Collections' now, and no offer goes out`;
    case 'APPROVE_UPDATE': { const doc = d.documents.filter((x: any) => x.state === 'PROPOSED' || x.state === 'REVIEW' || x.state === 'REJECT_RECOMMENDED').at(-1) ?? d.documents.at(-1); const conf = doc?.overall_confidence != null ? Math.round(Number(doc.overall_confidence) * 100) : null; return doc ? `Fahis read ${first(name)}'s ${DOC_LABEL[doc.type] ?? doc.type}${conf !== null ? ` at ${conf}%` : ''}; the record update waits on you` : `A record update for ${name} waits on you`; }
    case 'ACCEPT_EXPLAINED_GAP': { const p = d.proposals.find((x: any) => x.target === 'salary_credits' && x.state === 'PROPOSED'); return p ? `${first(name)}'s ${monthName(p.field)} gap is ${gapReason(String(p.new_value))}; accepting it clears the salary rule` : `An explained salary gap for ${name} waits on you`; }
    case 'APPROVE_HANDOFF': return f?.amount ? `${name} qualifies for ${qar(f.amount)}; the offer goes to One Click on your approval` : `${name}'s offer goes to One Click on your approval`;
    case 'ESCALATE_TO_RM': return `${name} needs a person: ${k.attempts} notice${k.attempts === 1 ? '' : 's'} without a reply`;
    case 'ADD_DNC': return `${name} asked not to be contacted`;
    case 'RESOLVE_FAILURE': return `A step failed on ${first(name)}'s case; resume it or close it`;
    case 'APPROVE_POLICY_CHANGE': return waiting?.title ?? `A policy change waits on you`;
    case 'DECIDE': return waiting?.payload?.route === 'COMPLIANCE' ? `${name}'s account is frozen or closed; Compliance says whether anything changes` : waiting?.payload?.route === 'DORMANT' ? `${name}'s account is dormant; the checker approves the reactivation` : waiting?.title ?? `${name}'s case waits on you`;
  }
  if (k.state === 'CLOSED') return `${first(name)}'s case closed: ${lc(title(k.close_code ?? 'closed'))}`;
  if (k.paused) return `${first(name)}'s case is paused: ${k.pause_reason ?? 'by a person'}`;
  const waitingOn = d.runs.find((r: any) => r.status === 'WAITING' || r.status === 'ESCALATED');
  if (waitingOn) return `${name}: ${lc(reason)}; waiting on the ${PERSONA_SHORT[waitingOn.waiting_on_persona] ?? waitingOn.waiting_on_persona}`;
  if (k.max_attempts) return `${name}: ${lc(reason)}; ${k.attempts} of ${k.max_attempts} notices sent${k.next_action_at ? `, the next ${rel(k.next_action_at, now)}` : ''}`;
  return `${name}: ${lc(reason)}`;
}

/** One fact: CogniPulse's figure tile, the value in words and the picture under it. */
const Fact = ({ label, value, children }: { label: ReactNode; value: ReactNode; children?: ReactNode }) => <FigureTile label={label} value={value}>{children}</FigureTile>;

/** An employer decision's two facts: the five criteria as segments, and the leverage — the customers who wait only on this approval — as dots. */
function EmployerFacts({ id }: { id: string }) {
  const { data } = useApi<any>(`/employers/${id}`);
  const { go } = useApp();
  if (!data) return <><Fact label="The five criteria" value="Reading the employer pack…" /><Fact label="Freed by this approval" value="…" /></>;
  const staff: any[] = data.staff ?? [];
  const criteria: any[] = data.reviews?.[0]?.pack?.criteria ?? [];
  const met = criteria.filter((c) => c.ok);
  const only = staff.filter((s) => s.live_reasons && s.live_reasons.length === 1 && s.live_reasons[0] === 'R02').length;
  return (
    <>
      <Fact label={<button type="button" className="hover:text-primary" onClick={() => go('employers', id)}>The five criteria</button>} value={criteria.length ? (met.length === criteria.length ? 'All five met' : `${criteria.length - met.length} not met: ${criteria.filter((c) => !c.ok).map((c) => lc(c.label)).join(', ')}`) : title(data.employer?.approval_status)}>
        {criteria.length ? <Segments items={criteria.map((c) => ({ label: `${c.label}: ${c.value} (needs ${c.required})`, on: !!c.ok }))} /> : null}
      </Fact>
      <Fact label="Freed by this approval" value={`${only} of ${staff.length} salaried customers`}>
        {staff.length <= 60 ? <Dots n={only} of={staff.length} /> : <CapBar used={only} cap={staff.length} />}
      </Fact>
    </>
  );
}

/** Up to three facts, each with its picture, chosen by what the decision is about. */
function Facts({ d, waiting, now }: { d: any; waiting: any; now: string }) {
  const k = d.case; const f = d.facts; const rules = d.rules ?? {};
  const action = waiting?.result?.actionType ?? waiting?.payload?.actionType ?? null;
  const facts: ReactNode[] = [];
  const expiry = k.primary_reason === 'R06' ? f?.passportExpiry : k.primary_reason === 'R07' ? f?.qidExpiry : null;
  const expiryDoc = k.primary_reason === 'R06' ? 'passport' : 'QID';
  const missing: string[] = f?.inputs?.salaryMissing ?? [];
  // 1 · the time picture: the salary months for a salary case, the restriction clock for an expired document, the turnaround when it waits on the person, else the next step
  if (k.primary_reason === 'R01' && f?.salaryCredits) {
    facts.push(<Fact key="salary" label="Salary credits, twelve months" value={missing.length ? `No credit in ${[...missing].sort().map((m) => monthName(m).split(' ')[0]).join(', ').replace(/, ([^,]*)$/, ' and $1')}` :f.inputs?.salaryLow?.length ? `${f.inputs.salaryLow.length} month${f.inputs.salaryLow.length === 1 ? '' : 's'} below the usual` : 'Every month credited'}><SalaryColumns credits={f.salaryCredits} now={now} /></Fact>);
  } else if (expiry && action !== 'COLLECTIONS_CADENCE_EXCEPTION' && k.state !== 'CLOSED') {
    const day = rules.restrictionProposalDay ?? 90; const days = daysBetween(expiry, now);
    facts.push(<Fact key="clock" label={`Days since the ${expiryDoc} expired, of ${day}`} value={days < 0 ? `Expires in ${-days} days` : `${days} days`}><CaseClock opened={expiry} now={now} hardAt={addDays(expiry, day).toISOString()} /></Fact>);
  } else if (waiting?.sla_due && action !== 'COLLECTIONS_CADENCE_EXCEPTION') {
    const since = waiting.updated_at ?? waiting.created_at; const over = daysBetween(waiting.sla_due, now);
    facts.push(<Fact key="sla" label="Waiting on you" value={`${daysBetween(since, now)} day${daysBetween(since, now) === 1 ? '' : 's'}${over > 0 ? `, ${over} late` : over === 0 ? ', due today' : ''}`}><CaseClock opened={since} now={now} hardAt={waiting.sla_due} /></Fact>);
  } else if (k.next_action_at && k.state !== 'CLOSED' && new Date(k.next_action_at) > new Date(k.updated_at ?? k.opened_at)) {
    const late = new Date(k.next_action_at) < new Date(now);
    facts.push(<Fact key="next" label={k.recheck_reason ? `The next step · ${k.recheck_reason}` : 'The next step'} value={`${late ? 'was due ' : ''}${rel(k.next_action_at, now)}`}><CaseClock opened={k.updated_at ?? k.opened_at} now={now} hardAt={k.next_action_at} /></Fact>);
  } else if (k.opened_at && action !== 'COLLECTIONS_CADENCE_EXCEPTION') {
    facts.push(<Fact key="opened" label="Open for" value={`${daysBetween(k.opened_at, now)} days`} />);
  }
  // 2 · the notices sent are on the conversation's time line below the facts, so they are not a fact here (each fact once)
  // 3 · what the decision turns on
  const rulesFact = f?.checks?.length ? (() => { const fails = f.checks.filter((c: any) => !c.pass); return <Fact key="rules" label="The twenty rules" value={fails.length ? `${f.checks.length - fails.length} of ${f.checks.length} pass` : 'All pass'}><RuleDots checks={f.checks} /></Fact>; })() : null;
  let employer: ReactNode = null;
  switch (action) {
    case 'DECIDE_EMPLOYER': if (f?.employerId) { employer = <EmployerFacts key="employer" id={f.employerId} />; facts.length = 0; if (rulesFact) facts.push(rulesFact); } break;
    case 'CLEAR_CAUTIONARY_NOTE': { const others = k.reasons.filter((r: string) => r !== 'R05'); facts.push(<Fact key="note" label="The note" value={NOTE_LABEL[waiting?.payload?.noteType] ?? 'cautionary'}><p className="text-[12px] text-muted-foreground">{others.length ? `Also failing: ${others.map((r: string) => lc(REASON_LABEL[r] ?? r)).join(', ')}` : 'Nothing else stands in the way'}</p></Fact>); break; }
    case 'RESUME_CASE': facts.push(<Fact key="words" label={`What ${first(k.name_en)} wrote`} value={<q className="block text-[14px] font-normal italic leading-snug">{waiting?.payload?.text}</q>} />); break;
    case 'COLLECTIONS_CADENCE_EXCEPTION': { const dpd = Number(waiting?.payload?.dpd ?? f?.dpd ?? 0); const boundary = rules.collectionsHandoffDpd ?? 30; facts.unshift(<Fact key="dpd" label="Days past due" value={`${dpd} of ${boundary}`}><CapBar used={dpd} cap={boundary} format={(v) => `${Math.round(v)} days`} /></Fact>); break; }
    case 'APPROVE_UPDATE': case 'ACCEPT_EXPLAINED_GAP': {
      const doc = d.documents.filter((x: any) => x.state === 'PROPOSED' || x.state === 'REVIEW' || x.state === 'REJECT_RECOMMENDED').at(-1) ?? d.documents.at(-1);
      const props = d.proposals.filter((p: any) => p.state === 'PROPOSED');
      if (doc) facts.push(<Fact key="doc" label={`What Fahis read · ${DOC_LABEL[doc.type] ?? doc.type}`} value={props.length ? plainProposal(props[0]) : `${lc(title(doc.recommendation))} recommended`}><Confidence value={doc.overall_confidence != null ? Number(doc.overall_confidence) : null} threshold={rules.oneClickReviewConfidence ?? 0.9} /></Fact>);
      break;
    }
    case 'APPROVE_HANDOFF': if (f?.amount && f?.inputs?.cap) facts.push(<Fact key="amount" label="The offer against the cap" value={qar(f.amount)}><Headroom value={f.amount} cap={f.inputs.cap} /></Fact>); break;
  }
  // a case at the collections boundary always shows how close it is to the hand-off
  if (k.cls === 'D' && f?.dpd != null && !facts.some((x: any) => x?.key === 'dpd')) { const boundary = rules.collectionsHandoffDpd ?? 30; facts.unshift(<Fact key="dpd" label="Days past due" value={`${f.dpd} of ${boundary}`}><CapBar used={Number(f.dpd)} cap={boundary} format={(v) => `${Math.round(v)} days`} /></Fact>); }
  // the twenty rules fill the third place when nothing more specific took it
  if (!employer && facts.length < 3 && rulesFact && !facts.some((x: any) => x?.key === 'rules')) facts.push(rulesFact);
  if (!facts.length && k.reasons?.length) facts.push(<Fact key="reasons" label="What is missing" value={<span className="flex flex-wrap gap-1 text-sm font-normal">{k.reasons.map((r: string) => <ReasonChip key={r} code={r} />)}</span>} />);
  const shown = facts.slice(0, employer ? 1 : 3);
  const n = shown.length + (employer ? 2 : 0);
  if (!n) return null;
  return <div className={`grid gap-3 ${n >= 3 ? 'sm:grid-cols-3' : n === 2 ? 'sm:grid-cols-2' : ''}`}>{employer}{shown}</div>;
}

/**
 * The case actions that go through the engine: the first as a button, the rest
 * behind one menu named for what is in it ("Pause, reschedule or escalate");
 * with a decision pending, all behind that menu, left of the decision.
 */
function CaseActions({ d, busy, act, collapsed }: { d: any; busy: string; act: (type: string, extra?: any) => void; collapsed?: boolean }) {
  const k = d.case;
  const all: { key: string; verb: string; label: string; danger?: boolean; run: () => void }[] = [];
  if (d.can.send && d.messages.some((m: any) => m.status === 'SCHEDULED')) all.push({ key: 'send', verb: 'send now', label: 'Send the next message now', run: () => act('SEND_REMINDER') });
  if (d.can.reschedule) all.push({ key: 'resched', verb: 'reschedule', label: 'Reschedule by a week', run: () => act('RESCHEDULE', { days: 7 }) });
  if (d.can.pause && !k.paused) all.push({ key: 'pause', verb: 'pause', label: 'Pause the case', run: () => act('PAUSE_CASE', { reason: 'Paused by a person' }) });
  if (d.can.resume && k.paused && !collapsed) all.push({ key: 'resume', verb: 'resume', label: 'Resume the case', run: () => act('RESUME_CASE') });
  if (d.can.escalate) all.push({ key: 'esc', verb: 'escalate', label: 'Escalate to a person', run: () => act('ESCALATE_TO_RM') });
  if (d.can.rerun) all.push({ key: 'rerun', verb: 're-check', label: 'Re-run the eligibility check', run: () => act('RERUN_QUALIFICATION') });
  if (d.can.restrict && k.cls === 'A') all.push({ key: 'restrict', verb: 'restrict', label: 'Propose a restriction', run: () => act('PROPOSE_RESTRICTION') });
  if (d.can.close) all.push({ key: 'close', verb: 'close', label: 'Close as unresponsive', danger: true, run: () => act('CLOSE_UNRESPONSIVE', { reason: 'Closed by a person' }) });
  if (!all.length || k.state === 'CLOSED') return null;
  const shown = collapsed ? [] : all.slice(0, 1), more = collapsed ? all : all.slice(1);
  const verbs = more.map((a) => a.verb);
  const menuName = (verbs.length === 1 ? more[0].label : `${verbs.slice(0, -1).join(', ')} or ${verbs.at(-1)}`).replace(/^[a-z]/, (c) => c.toUpperCase());
  return (
    <div className="flex flex-wrap items-center gap-2">
      {more.length === 1 ?<Btn small kind={more[0].danger ? 'danger' : undefined} onClick={more[0].run} disabled={!!busy}>{more[0].label}</Btn> : more.length ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild><button type="button" className="pill-btn pill-btn-ghost px-3 py-1.5 text-xs" disabled={!!busy} title="Actions on the case">{menuName} <ChevronDown className="ms-1 h-3 w-3" /></button></DropdownMenuTrigger>
          <DropdownMenuContent align="start">{more.map((a) => <DropdownMenuItem key={a.key} onSelect={a.run} className={a.danger ? 'text-danger' : ''}>{a.label}</DropdownMenuItem>)}</DropdownMenuContent>
        </DropdownMenu>
      ) : null}
      {shown.map((a) => <Btn key={a.key} small kind={a.danger ? 'danger' : 'primary'} onClick={a.run} disabled={!!busy}>{a.label}</Btn>)}
      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" /> : null}
    </div>
  );
}

const ALARM_REPLY = new Set(['HARDSHIP', 'COMPLAINT', 'DISPUTE', 'OPT_OUT']);
const REPLY_WORD: Record<string, string> = { DOCUMENT: 'a document', QUESTION: 'a question', DISPUTE: 'a dispute', OPT_OUT: 'an opt-out', HARDSHIP: 'hardship', COMPLAINT: 'a complaint', OUT_OF_OFFICE: 'an out-of-office', UNRELATED: 'something unrelated', ACCEPT: 'an acceptance' };

type Turn = { at: string; who: string; what: string; channel: string; tone?: 'danger' | 'warn' };

/** The customer's notices and replies as a short dated list, oldest first: date, who (the bank, the customer, you), what happened, through which channel; the last row is the decision's due date, and how late it is. */
function Conversation({ d, waiting, now }: { d: any; waiting: any; now: string }) {
  const { persona } = useApp();
  const [all, setAll] = useState(false);
  const k = d.case; const f = d.facts; const rules = d.rules ?? {};
  const channel = (c: any) => CHANNEL_WORD[String(c ?? '').toUpperCase()] ?? String(c ?? '').toLowerCase();
  const turns: Turn[] = [];
  for (const m of d.messages) {
    if (m.status === 'CANCELLED') continue;
    const at = m.sent_at ?? m.scheduled_for; if (!at) continue;
    const blocked = m.status === 'BLOCKED' || m.status === 'FAILED';
    const what = `${title(m.message_type)}${m.attempt ? ` (notice ${m.attempt})` : ''} ${m.status === 'SCHEDULED' ? 'planned' : blocked ? `blocked${m.block_reason ? `: ${lc(m.block_reason)}` : ''}` : 'sent'}`;
    turns.push({ at, who: 'The bank', what, channel: channel(m.channel), tone: blocked ? 'danger' : undefined });
  }
  for (const i of d.inbound) turns.push({ at: i.received_at, who: 'The customer', what: `Replied with ${REPLY_WORD[i.classification] ?? lc(title(i.classification ?? 'a reply'))}`, channel: channel(i.channel), tone: ALARM_REPLY.has(i.classification) ? 'danger' : undefined });
  if (!turns.length) return null; // an employer, a note or a policy decision: nobody was asked, so there is no conversation to list
  // what a person at the bank did on the case; the signed-in person is "you"
  for (const e of d.trail) {
    if (e.actor_type !== 'HUMAN') continue;
    const mine = e.actor_id === persona?.key;
    const said = plainTrail(e.summary);
    const lead = String(e.actor_name ?? '').split(' (')[0];
    turns.push({ at: e.at, who: mine ? 'You' : 'The bank', what: mine && lead && said.startsWith(lead) ? said.slice(lead.length).trim().replace(/^[a-z]/, (c) => c.toUpperCase()) : said, channel: 'Jahiz' });
  }
  const expiry = k.primary_reason === 'R06' ? f?.passportExpiry : k.primary_reason === 'R07' ? f?.qidExpiry : null;
  const due = waiting?.sla_due ?? (expiry && k.state !== 'CLOSED' ? addDays(expiry, rules.restrictionProposalDay ?? 90).toISOString() : null);
  const sorted = turns.filter((t) => !due || t.at <= due || new Date(t.at) <= new Date(now)).sort((a, b) => String(a.at).localeCompare(String(b.at)));
  const rows = all ? sorted : sorted.slice(-5);
  const late = due ? daysBetween(due, now) : 0;
  const cell = 'py-1 pe-3 align-top';
  return (
    <div className="rounded-xl glass-l3 px-4 py-3">
      <p className="flex items-center justify-between text-[12px] text-muted-foreground"><span>Notices and replies</span>{sorted.length > 5 ? <button type="button" className="text-primary" onClick={() => setAll((x) => !x)}>{all ? 'Show the last five' : `Show all ${sorted.length}`}</button> : null}</p>
      <table className="mt-1 w-full text-[13px] leading-snug">
        <tbody>
          {rows.map((t, n) => (
            <tr key={n} className="border-t border-border/40 first:border-t-0">
              <td className={`${cell} whitespace-nowrap text-muted-foreground`}>{date(t.at)}</td>
              <td className={`${cell} whitespace-nowrap font-medium`}>{t.who}</td>
              <td className={`${cell} ${t.tone === 'danger' ? 'text-danger' : ''}`}>{t.what}</td>
              <td className={`${cell} whitespace-nowrap pe-0 text-end text-muted-foreground`}>{t.channel}</td>
            </tr>
          ))}
          {due ? (
            <tr className="border-t border-border/60">
              <td className={`${cell} whitespace-nowrap font-medium ${late > 0 ? 'text-danger' : 'text-warn'}`}>{date(due)}</td>
              <td className={`${cell} whitespace-nowrap font-medium`}>{waiting ? 'You' : 'The bank'}</td>
              <td className={`${cell} font-medium ${late > 0 ? 'text-danger' : 'text-warn'}`} colSpan={2}>{waiting ? 'Your decision is due' : 'The restriction decision is due'}{late > 0 ? `, ${late} day${late === 1 ? '' : 's'} late` : late === 0 ? ', today' : `, in ${-late} day${late === -1 ? '' : 's'}`}</td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}

/** What declining does, by workflow: the engine's rejection hook in a person's words. */
const ON_DECLINE: Record<string, string> = {
  APPROVE_UPDATE: 'The document is rejected and nothing on the record changes; Munadi asks the customer again for a clear, current copy.',
  ACCEPT_EXPLAINED_GAP: 'The gap stays unexplained and the salary rule keeps failing; Munadi asks the customer again for a salary certificate.',
  DECIDE_EMPLOYER: 'The employer stays unapproved; every case waiting on it is parked and reviewed again in six months.',
  CLEAR_CAUTIONARY_NOTE: 'The note stays and nobody is contacted; the case is reviewed again in three months.',
  RESUME_CASE: 'The case stays paused: no automated message goes, and it stays with a person.',
  DECIDE_RESTRICTION: 'No restriction; the case stays with a person and is reviewed again in thirty days.',
  APPROVE_POLICY_CHANGE: 'The policy stays as it is; the proposed version is recorded as declined.',
  APPROVE_HANDOFF: 'The offer is held; the customer hears nothing and the case stays open.',
};

/** What approving does where the next steps alone do not say it. */
const ON_APPROVE: Record<string, string> = {
  RESUME_CASE: 'Automated outreach resumes and the case waits on the customer again.',
};

/** If you approve, if you decline: the steps the engine runs next, and what declining does. Without a decision, what happens next. */
function WhatNext({ d, waiting, now, wide }: { d: any; waiting: any; now: string; wide?: boolean }) {
  const k = d.case;
  const who = (s: any) => s.actor_type === 'HUMAN' ? (PERSONA_SHORT[s.actor_id] ?? 'A person') : s.actor_type === 'SYSTEM' ? 'The record' : (s.actor_id ? s.actor_id[0].toUpperCase() + s.actor_id.slice(1) : 'An agent');
  const run = waiting ?? d.runs.find((r: any) => !['COMPLETED', 'REJECTED', 'CANCELLED'].includes(r.status));
  const ahead: any[] = run?.steps?.filter((s: any) => s.status === 'PENDING') ?? [];
  const list = (steps: any[]) => <ol className="mt-1 space-y-0.5">{steps.slice(0, 4).map((s) => <li key={s.id} className="text-[13px] leading-snug"><span className="font-medium">{who(s)}</span> · {s.label.replace(/^[A-Z]/, (c: string) => c.toLowerCase())}</li>)}</ol>;
  if (waiting) {
    const action = waiting.result?.actionType ?? waiting.payload?.actionType ?? 'DECIDE';
    const decline = waiting.status === 'ESCALATED' ? 'The run closes where it stopped; the case stays as it is.' : ON_DECLINE[action] ?? 'The run closes; the case stays where it is and your reason is on the trail.';
    return (
      <div className={`grid gap-3 rounded-xl glass-l3 px-4 py-3 ${wide ? 'sm:grid-cols-2' : ''}`}>
        <div className="border-s-2 border-success ps-3">
          <p className="text-[12px] text-muted-foreground">If you approve</p>
          {ON_APPROVE[action] ? <p className="mt-1 text-[13px] leading-snug">{ON_APPROVE[action]}</p> : null}
          {ahead.length ? list(ahead) : ON_APPROVE[action] ? null : <p className="mt-1 text-[13px]">The workflow ends here.</p>}
        </div>
        <div className="border-s-2 border-danger ps-3">
          <p className="text-[12px] text-muted-foreground">If you decline</p>
          <p className="mt-1 text-[13px] leading-snug">{decline}</p>
        </div>
      </div>
    );
  }
  if (k.state === 'CLOSED') return null;
  return (
    <div className="rounded-xl glass-l3 px-4 py-3">
      <p className="text-[12px] text-muted-foreground">What happens next{k.next_action_at ? `, ${rel(k.next_action_at, now)}` : ''}</p>
      {ahead.length ? list(ahead) : <p className="mt-1 text-[13px]">{k.recheck_reason ? `A re-check: ${lc(k.recheck_reason)}` : 'Nothing is scheduled; the nightly check looks at the case again.'}</p>}
    </div>
  );
}

const CHANNEL_WORD: Record<string, string> = { PUSH: 'push', INAPP: 'in-app', EMAIL: 'e-mail', SMS: 'SMS', WHATSAPP: 'WhatsApp', CALL: 'call', LETTER: 'letter', POST: 'post', BRANCH: 'branch' };
/** A trail line as the Stage's log would say it: no case ids, codes, scores, clauses or run numbers. */
const plainTrail = (s: string) => plainSummary(String(s ?? '')
  .replace(/\s*\[[^\]]*\]/g, '')
  .replace(/^Opened [A-Z]+-[A-Z]+-\d+:/, 'Opened the case:')
  .replace(/\b[A-Z]{2,}-[A-Z]+-\d+:?\s*/g, '')
  .replace(/\bR\d{2}\s+(?=[A-Z])/g, '')
  .replace(/\s*→\s*class [A-D],\s*WF-\d+(?:\/\d+)?/g, '')
  .replace(/\s*\((?:EN|AR), (attempt \d+)\)/g, ' ($1)')
  .replace(/\s*\(\d\.\d+,(?:[^()]|\([^)]*\))*\)/g, '')
  .replace(/\s*\((?:Claude|Offline)(?:[^()]|\([^)]*\))*\)/g, '')
  .replace(/\s*\(?run \d+\)?/g, '')
  .replace(/\b(PUSH|INAPP|EMAIL|SMS|WHATSAPP|CALL|LETTER|POST|BRANCH)\b/g, (m) => CHANNEL_WORD[m] ?? m)
  .replace(/\b(HARDSHIP|COMPLAINT|DOCUMENT|QUESTION|DISPUTE|OPT_OUT|OUT_OF_OFFICE|UNRELATED)\b/g, (m) => REPLY_WORD[m]?.replace(/^an? /, '') ?? m.toLowerCase())
  .replace(/\b1 ((?:\w+ )?\w+)\(s\)/g, '1 $1').replace(/(\w)\(s\)/g, '$1s'))
  .replace(/:\s*its own workflow$/, '')
  .trim();

/** The agents' own log of the case in plain words, oldest first: who, then what; the last five, the rest on "Show all". It is proof, so it sits behind "How this was checked". */
function AgentLog({ d, now }: { d: any; now: string }) {
  const [all, setAll] = useState(false);
  const sorted = [...d.trail].sort((a: any, b: any) => String(a.at).localeCompare(String(b.at)) || a.id - b.id);
  const rows = all ? sorted : sorted.slice(-5);
  if (!rows.length) return null;
  const tone = (e: any) => e.actor_type === 'HUMAN' ? 'text-foreground' : e.actor_type === 'SYSTEM' && e.actor_id !== 'muhaddith' ? 'text-muted-foreground' : 'text-primary';
  const name = (e: any) => e.actor_type === 'HUMAN' ? e.actor_name : (e.actor_name ?? e.actor_id);
  const text = (e: any) => plainTrail(e.summary);
  return (
    <ReaderSection label="What the agents did" action={sorted.length > 5 ? <button type="button" className="text-[12px] text-primary" onClick={() => setAll((x) => !x)}>{all ? 'Show the last five' : `Show all ${sorted.length}`}</button> : undefined}>
      <ol className="space-y-1 text-[13px] leading-snug">
        {rows.map((e: any) => (
          <li key={e.id} className="grid grid-cols-[64px_minmax(0,1fr)] gap-x-2">
            <span className="pt-0.5 text-[11px] text-muted-foreground">{rel(e.at, now)}</span>
            <span className="min-w-0"><span className={`font-semibold ${tone(e)}`}>{name(e)}:</span> {text(e).replace(/^[A-Z](?=[a-z])/, (c) => c.toLowerCase())}</span>
          </li>
        ))}
      </ol>
    </ReaderSection>
  );
}

/** The proof behind the card: everything the engine knows about the case, closed until asked for; the agents' log in plain words first. */
function CaseProof({ d, now }: { d: any; now: string }) {
  const { go } = useApp();
  const k = d.case;
  return (
    <Provenance label="How this was checked" className="mt-0">
      <AgentLog d={d} now={now} />
      {d.documents.length ? (
        <ReaderSection label="Documents and proposed updates">
          <ul className="space-y-2">{d.documents.map((doc: any) => (
            <li key={doc.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-border/60 bg-card/50 p-2 text-[12px]">
              <button type="button" onClick={() => go('documents', String(doc.id))} className="font-medium text-primary">{DOC_LABEL[doc.type] ?? doc.type}</button><StatusChip status={doc.state} />{doc.recommendation ? <Chip tone={doc.recommendation === 'APPROVE' ? 'success' : doc.recommendation === 'REJECT' ? 'danger' : 'warn'}>{doc.recommendation.toLowerCase()} recommended</Chip> : null}{doc.overall_confidence ? <span>{Math.round(Number(doc.overall_confidence) * 100)}% read confidence</span> : null}<Chip>{doc.assurance === 'APP_UPLOAD' ? 'uploaded in the app' : doc.assurance === 'RM_SCAN' ? 'collected by the RM' : title(doc.assurance)}</Chip>{doc.mode ? <StatusChip status={doc.mode} /> : null}{(doc.flags ?? []).map((f: string) => <Chip key={f} tone="danger">{f.replace(/_/g, ' ').toLowerCase()}</Chip>)}<span className="ms-auto text-muted-foreground">{dateTime(doc.received_at)}</span>
            </li>))}</ul>
          <div className="mt-2"><Proposals rows={d.proposals} /></div>
        </ReaderSection>
      ) : null}
      <ReaderSection label="Messages" action={<button type="button" className="text-[12px] text-primary" onClick={() => go('comms', `customer=${k.customer_id}`)}>all for this customer</button>}><Messages rows={d.messages} compact /></ReaderSection>
      {d.inbound.length ? <ReaderSection label="What the customer sent"><ul className="space-y-1">{d.inbound.map((i: any) => <li key={i.id} className="rounded-lg border border-border/60 bg-card/50 p-2 text-[12px]"><span className="text-muted-foreground">{dateTime(i.received_at)} · {i.channel}</span> <StatusChip status={i.classification} /> {i.confidence ? <span>{Math.round(Number(i.confidence) * 100)}%</span> : null} {i.mode ? <StatusChip status={i.mode} /> : null}<p className="mt-0.5">{i.body}</p>{i.routed_to ? <p className="text-muted-foreground">→ {i.routed_to}</p> : null}</li>)}</ul></ReaderSection> : null}
      {d.tasks.length ? <ReaderSection label="Tasks for people"><ul className="space-y-1 text-[12px]">{d.tasks.map((t: any) => <li key={t.id} className="flex flex-wrap items-center gap-2"><Chip>{t.kind.replace(/_/g, ' ').toLowerCase()}</Chip><span>{t.title}</span><span className="text-muted-foreground">→ {PERSONA_SHORT[t.assignee_persona]}</span><StatusChip status={t.state} />{t.outcome ? <span className="text-muted-foreground">· {t.outcome}</span> : null}</li>)}</ul></ReaderSection> : null}
      <ReaderSection label="The workflow, step by step">
        <div className="space-y-3">{d.runs.map((r: any) => (
          <div key={r.id} className="rounded-xl border border-border/60 bg-card/40 p-3">
            <p className="flex flex-wrap items-center gap-2 text-sm"><span className="font-medium">{r.title}</span><Chip title={r.workflow_id}>{r.workflow_id}</Chip><StatusChip status={r.status} />{r.waiting_on_persona ? <Chip tone="warn">waits on {PERSONA_SHORT[r.waiting_on_persona]}</Chip> : null}{r.waiting_event ? <Chip>waits for {r.waiting_event.toLowerCase()}</Chip> : null}<span className="ms-auto text-[11px] text-muted-foreground">{r.channel} · {dateTime(r.created_at)}</span></p>
            <div className="mt-2"><Steps steps={r.steps} /></div>
          </div>))}</div>
      </ReaderSection>
      <ReaderSection label="The trail"><TrailList rows={[...d.trail].reverse()} compact /></ReaderSection>
      <p className="text-[11px] text-muted-foreground">Case {k.ref} · customer {k.customer_id}{k.rm_id ? ` · RM ${k.rm_id}` : ''}{k.edge_key ? ` · ${k.edge_key}` : ''} · {num(d.trail.length)} entries on the trail</p>
    </Provenance>
  );
}

/** "QID expired · Rajesh Kumar Nair · Mass · waiting on you, due today": what it is, whose, and whose move it is. */
function MetaLine({ d, waiting, other, now }: { d: any; waiting: any; other: any; now: string }) {
  const { open } = useApp();
  const k = d.case;
  const due = waiting?.sla_due ? daysBetween(now, waiting.sla_due) : null;
  const whose = waiting ? `waiting on you${due === null ? '' : due < 0 ? `, ${-due} day${due === -1 ? '' : 's'} late` : due === 0 ? ', due today' : `, due ${rel(waiting.sla_due, now)}`}`
    : other ? `waiting on the ${PERSONA_SHORT[other.waiting_on_persona] ?? other.waiting_on_persona}`
    : k.state === 'CLOSED' ? 'closed' : k.paused ? 'paused' : k.state === 'AWAITING_REPLY' ? 'waiting on the customer' : lc(title(k.state));
  return (
    <p className="flex flex-wrap items-center gap-x-1.5 text-[12px] text-muted-foreground">
      <span>{REASON_LABEL[k.primary_reason] ?? 'Case'}</span><span>·</span>
      <button type="button" className="font-medium text-foreground hover:text-primary" onClick={() => open(`customer:${k.customer_id}`)} title="Open the customer record">{k.name_en}</button><span>·</span>
      <span>{SEG[k.segment] ?? k.segment}</span><span>·</span>
      <span className={waiting && due !== null && due < 0 ? 'text-danger' : waiting ? 'text-warn' : undefined}>{whose}</span>
    </p>
  );
}

/** The case's facts and their pictures alone, for a task or a record that points at the case. */
export function CaseFacts({ refCode }: { refCode: string }) {
  const { session } = useApp();
  const { data: d } = useApi<any>(`/cases/${encodeURIComponent(refCode)}`);
  if (!d) return null;
  return <Facts d={d} waiting={null} now={d.now ?? session?.clock.now ?? new Date().toISOString()} />;
}

/** The case: the decision card, then the one disclosure. In the Inbox it fills the reader, the decision pinned at the foot. */
export function CaseReader({ refCode, inReader }: { refCode: string; inReader?: boolean }) {
  const { persona, open, session } = useApp();
  const { data: d, error, reload } = useApi<any>(`/cases/${encodeURIComponent(refCode)}`);
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState('');
  if (error) return <Empty>{error}</Empty>;
  if (!d) return <p className="p-4 text-sm text-muted-foreground">Loading…</p>;
  const k = d.case;
  const now: string = d.now ?? session?.clock.now ?? new Date().toISOString();
  const waiting = d.runs.find((r: any) => (r.status === 'WAITING' || r.status === 'ESCALATED') && r.waiting_on_persona === persona?.key);
  const other = !waiting ? d.runs.find((r: any) => r.status === 'WAITING' || r.status === 'ESCALATED') : null;
  const talked = d.messages.some((m: any) => m.status !== 'CANCELLED') || d.inbound.length > 0;
  const act = async (type: string, extra: any = {}) => { setBusy(type); setMsg(''); try { const r = await post(`/cases/${k.ref}/action`, { type, ...extra }); setMsg(r.result); bump(); reload(); } catch (e: any) { setMsg(e.message); } finally { setBusy(''); } };
  const header = (
    <header>
      <MetaLine d={d} waiting={waiting} other={other} now={now} />
      <h2 className="mt-1.5 text-lg font-semibold leading-snug tracking-tight">{headlineOf(d, waiting, now)}</h2>
      {d.successor && d.successor !== refCode ? <p className="mt-1 text-[12px] text-muted-foreground">The leading reason was cured and the next one took over: <button type="button" className="text-primary" onClick={() => open(`case:${d.successor}`)}>follow the customer to the new case</button>.</p> : null}
    </header>
  );
  const body = (
    <div className="space-y-3">
      <Facts d={d} waiting={waiting} now={now} />
      {waiting ? <Recommendation run={waiting} omitQuote={(waiting.result?.actionType ?? waiting.payload?.actionType) === 'RESUME_CASE'} /> : null}
      {msg ? <p className="text-[12px] text-muted-foreground">{msg}</p> : null}
      <div className={`grid gap-3 ${talked ? 'lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]' : ''}`}>
        <Conversation d={d} waiting={waiting} now={now} />
        <WhatNext d={d} waiting={waiting} now={now} wide={!talked} />
      </div>
      <CaseProof d={d} now={now} />
    </div>
  );
  const actions = waiting
    ? <Decide run={waiting} onDone={reload} extra={<CaseActions d={d} busy={busy} act={act} collapsed />} />
    : <CaseActions d={d} busy={busy} act={act} />;
  // The body scrolls between the header and the decision and fades out above the decision, so nothing reads as sitting under it.
  if (inReader) return <InboxReader header={header} actions={actions} className="case-reader h-full">{body}</InboxReader>;
  // The drawer: the same shape as the Inbox reader, the header and the decision pinned, the body scrolling between them.
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="shrink-0 border-b border-border/60 px-6 pb-4 pe-14 pt-6">{header}</div>
      <div className="case-scroll min-h-0 flex-1 overflow-y-auto px-6 py-4">{body}</div>
      {actions ? <div className="shrink-0 border-t border-border/60 bg-background px-6 py-3">{actions}</div> : null}
    </div>
  );
}

export function CaseDrawer() {
  const { caseRef, openCase, director } = useApp();
  const flash = useFlash('cases', caseRef);
  // While the Director runs, the drawer is non-modal so the Director bar stays usable;
  // clicks on the bar must not dismiss the drawer.
  const directing = !!director;
  const { present } = usePresent(); // while presenting the drawer starts under the Present bar, so its controls stay visible
  return (
    <Sheet open={!!caseRef} onOpenChange={(o) => !o && openCase(null)} modal={!directing}>
      <SheetContent side="right" className={`flex w-full flex-col overflow-hidden p-0 sm:max-w-2xl ${directing ? 'pb-48 shadow-2xl' : ''} ${present ? 'present-drawer' : ''} ${flash}`} onInteractOutside={(e) => { if (directing) e.preventDefault(); }}>
        <SheetTitle className="sr-only">Case {caseRef}</SheetTitle>
        {caseRef ? <CaseReader refCode={caseRef} /> : null}
      </SheetContent>
    </Sheet>
  );
}
