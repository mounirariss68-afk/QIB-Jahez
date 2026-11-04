/**
 * Settings — "Who am I acting as, and what is connected?" CogniPulse's
 * SettingsLayout: the sections on the left, one at a time on the right. The
 * persona switcher first; who may do what in words; Claude and the
 * connections with their file and variable names behind each disclosure; the
 * demo's storylines; the synthetic data. A settings screen carries no decision,
 * so it carries no picture.
 */
import { useState } from 'react';
import { PersonaSwitcher, SettingsGroup, SettingsLayout, SettingsNavItem, SettingsRow } from '@cognirise/cognipulse/archetypes';
import { Loader2 } from 'lucide-react';
import { bump, post, useApi } from '../lib/api';
import { num } from '../lib/format';
import { useApp } from '../app/state';
import { AGENT_NAMES, Btn, Chip, Empty, Hero, Note, Screen, StatusChip, Table } from '../app/ui';
import { StorylineEditor } from '../app/present';

/** Who may do what, in the person's words; the engine's action name travels in the hover. */
const MATRIX: [string, string, string][] = [
  ['SEND_REQUEST / SEND_REMINDER', 'Send the next notice now', 'Head · Operations (Mass, High Value) · Supervisor · RM (own book)'],
  ['RESCHEDULE', 'Reschedule a notice', 'Head · Operations · Supervisor · RM · Collections (arrears)'],
  ['PAUSE / RESUME', 'Pause or resume a case', 'Head · Operations · Supervisor · Compliance · RM · Collections (arrears)'],
  ['ESCALATE_TO_RM', 'Hand a case to a person', 'Head · Operations · Supervisor'],
  ['PROPOSE_UPDATE (maker)', 'Propose a record update (maker)', 'Operations · Supervisor · RM'],
  ['APPROVE / REJECT_UPDATE (checker)', 'Approve or reject a record update (checker)', 'Head · Supervisor'],
  ['ACCEPT_EXPLAINED_GAP', 'Accept an explained salary gap', 'Head · Credit (High Value, HNWI, VVIP) · Supervisor (Mass)'],
  ['OPEN_EMPLOYER_REVIEW', 'Open an employer review', 'Head · Credit · Operations · Supervisor · RM'],
  ['DECIDE_EMPLOYER', 'Approve or decline an employer', 'Head · Credit'],
  ['RERUN_QUALIFICATION', 'Re-run the eligibility check', 'Head · Credit · Operations · Supervisor · RM · Collections (arrears)'],
  ['APPROVE_HANDOFF (HNWI/VVIP)', 'Hand an HNWI or VVIP offer to One Click', 'Head · RM'],
  ['PROPOSE_RESTRICTION', 'Propose a card restriction', 'Head · Operations · Supervisor · RM'],
  ['DECIDE_RESTRICTION', 'Decide a card restriction', 'Head (VVIP) · Supervisor (Mass, High Value) · RM (HNWI)'],
  ['CLOSE_UNRESPONSIVE', 'Close a case as unresponsive', 'Head · Supervisor · RM'],
  ['CLEAR / RECLASSIFY_CAUTIONARY_NOTE', 'Clear or reclassify a cautionary note', 'Compliance'],
  ['ADD / REMOVE_DNC', 'Add to or remove from do-not-contact', 'Compliance'],
  ['COLLECTIONS_CADENCE_EXCEPTION', 'Take a case past the collections boundary', 'Collections'],
  ['PROPOSE_POLICY_CHANGE', 'Propose a policy change', 'Head (every rule) · Credit (eligibility, employers) · Supervisor (contact, documents) · Compliance (privacy, suppression, conduct) · Data Steward (the definitions)'],
  ['APPROVE_POLICY_CHANGE', 'Approve a policy change', 'Head (contact, eligibility, segments) · Credit (employers) · Supervisor (documents) · Compliance (privacy, suppression, conduct)'],
];

type Section = 'personas' | 'authority' | 'ai' | 'demo' | 'data';

export function SettingsScreen() {
  const { data, error } = useApi<any>('/settings');
  const { switchPersona, persona } = useApp();
  const [section, setSection] = useState<Section>('personas');
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false); const [msg, setMsg] = useState('');
  if (error) return <Empty>{error}</Empty>;
  if (!data) return <p className="p-6 text-sm text-muted-foreground">Loading…</p>;
  const agentsOf = (ids: string[]) => ids.map((id) => AGENT_NAMES[id]?.[0] ?? id).join(', ');
  const nav: [Section, string][] = [['personas', 'Who you act as'], ['authority', 'Who may do what'], ['ai', 'Claude and the connections'], ['demo', 'Present mode'], ['data', 'The synthetic data']];
  return (
    <Screen hero={<Hero eyebrow="Demo · Settings" title={`You are acting as ${persona?.name ?? '—'}, ${persona?.role ?? ''}; Claude is ${data.ai.mode === 'claude' ? 'connected' : 'not connected, so the agents run Offline'}`} />}>
      {msg ? <Note>{msg}</Note> : null}
      <SettingsLayout nav={nav.map(([id, label]) => <SettingsNavItem key={id} active={section === id} onSelect={() => setSection(id)}>{label}</SettingsNavItem>)}>
        {section === 'personas' ? (
          <SettingsGroup title="Who you act as" description="Switching changes the inbox, the scope, what you may approve and what Dalil will do for you.">
            <PersonaSwitcher value={persona?.key ?? ''} onChange={(k) => switchPersona(k)}
              personas={data.personas.map((p: any) => ({ id: p.key, name: p.name, role: p.role, initials: p.initials, remit: <>{p.sees}{p.owns.length ? <span className="mt-1 block text-[12px] text-muted-foreground">Answers for {agentsOf(p.owns)}</span> : null}</> }))} />
          </SettingsGroup>
        ) : null}
        {section === 'authority' ? (
          <SettingsGroup title="Who may do what" description="Each action the engine allows, and the people who may take it. The bank's credit model remains the credit decision.">
            <Table><thead><tr><th>Action</th><th>Who may</th></tr></thead><tbody>{MATRIX.map(([code, a, w]) => <tr key={code} title={code}><td className="text-[13px]">{a}</td><td className="text-[13px] text-muted-foreground">{w}</td></tr>)}</tbody></Table>
          </SettingsGroup>
        ) : null}
        {section === 'ai' ? (
          <SettingsGroup title="Claude and the connections" description="Everything that decides is deterministic. Five agents use Claude for four kinds of work: Dalil's conversation, Mustaqbil's reading of replies, Fahis's reading of documents, and the drafts Munadi and Muwathiq prepare for a person. Without the connection each of those steps runs Offline and says so.">
            {data.connectors.map((c: any) => (
              <SettingsRow key={c.id} label={c.name}
                hint={<details className="group"><summary className="cursor-pointer list-none text-[12px] text-muted-foreground hover:text-foreground">How it is wired ▸</summary><p className="mt-1 text-[12px]">{c.note}</p>{c.id === 'GRAPH' ? <p className="mt-1 text-[12px]">Needs {data.graph.needs.join(', ')} and the Mail.Send and Mail.ReadWrite permissions on a shared mailbox.</p> : null}</details>}
                control={c.id === 'ANTHROPIC' ? <StatusChip status={data.ai.mode} /> : <Chip tone={c.status === 'simulated' ? 'primary' : c.status === 'stubbed' ? 'warn' : undefined}>{c.status}</Chip>} />
            ))}
          </SettingsGroup>
        ) : null}
        {section === 'demo' ? (
          <SettingsGroup title="Present mode" description="Present mode replaces the slides: the cards are drawn by the app with live numbers, each story hands the room to the Director with the menu hidden, and a card after it says what it did. → and ← move, F is full screen, Esc leaves.">
            <StorylineEditor />
          </SettingsGroup>
        ) : null}
        {section === 'data' ? (
          <SettingsGroup title="The synthetic data" description={`Built ${data.seed?.at ? new Date(data.seed.at).toLocaleString('en-GB') : '—'} from seed ${data.seed?.seed ?? '—'}; ${num(2400)} customers by default. A reset rebuilds the world from these values and replays sixty days, in about two minutes.`}
            action={<Btn kind="danger" small disabled={busy} onClick={async () => { if (!confirm('Rebuild the synthetic world with these values? About two minutes.')) return; setBusy(true); setMsg('Rebuilding…'); try { const params: any = {}; for (const p of data.data) { const v = edits[p.key]; if (v === undefined) continue; params[p.key] = p.type === 'number' ? Number(v) : p.type === 'list' ? v.split(',').map((s: string) => s.trim()) : v; } await post('/control/reset', { params: Object.keys(params).length ? { ...(await (await fetch('/api/policies')).json()).params.reduce((m: any, x: any) => { m[x.key] = x.stored ?? x.value; return m; }, {}), ...params } : undefined }); setMsg('Rebuilt. The clock is at today 09:00 Doha.'); bump(); } catch (e: any) { setMsg(e.message); } finally { setBusy(false); } }}>{busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}Reset the demo with these values</Btn>}>
            {data.data.map((p: any) => (
              <SettingsRow key={p.key} label={<span title={p.key}>{p.label}{p.unit ? <span className="font-normal text-muted-foreground"> · {p.unit}</span> : null}</span>} hint={p.basis}
                control={<input className="input h-8 w-64 text-[13px]" value={edits[p.key] ?? (Array.isArray(p.value) ? p.value.join(', ') : String(p.value))} onChange={(e) => setEdits({ ...edits, [p.key]: e.target.value })} />} />
            ))}
          </SettingsGroup>
        ) : null}
      </SettingsLayout>
    </Screen>
  );
}
