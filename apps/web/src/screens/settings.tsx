/** Settings — personas and authority, synthetic data, connectors, AI. */
import { useState } from 'react';
import { Panel, PageColumns } from '@cognirise/atelier/layout';
import { Database, Loader2, Network, Presentation, Sparkles, Users } from 'lucide-react';
import { bump, post, useApi } from '../lib/api';
import { num } from '../lib/format';
import { useApp } from '../app/state';
import { Btn, Chip, Empty, Hero, Note, Screen, StatusChip, Table } from '../app/ui';
import { StorylineEditor } from '../app/present';

const MATRIX: [string, string][] = [
  ['SEND_REQUEST / SEND_REMINDER', 'Head · Ops (Mass/HV) · Supervisor · RM (own book)'], ['RESCHEDULE', 'Head · Ops · Supervisor · RM · Collections (class D)'], ['PAUSE / RESUME', 'Head · Ops · Supervisor · Compliance · RM · Collections (D)'], ['ESCALATE_TO_RM', 'Head · Ops · Supervisor'],
  ['PROPOSE_UPDATE (maker)', 'Ops · Supervisor · RM'], ['APPROVE / REJECT_UPDATE (checker)', 'Head · Supervisor'], ['ACCEPT_EXPLAINED_GAP', 'Head · Credit (HV/HNWI/VVIP) · Supervisor (Mass)'], ['OPEN_EMPLOYER_REVIEW', 'Head · Credit · Ops · Supervisor · RM'], ['DECIDE_EMPLOYER', 'Head · Credit'],
  ['RERUN_QUALIFICATION', 'Head · Credit · Ops · Supervisor · RM · Collections (D)'], ['APPROVE_HANDOFF (HNWI/VVIP)', 'Head · RM'], ['PROPOSE_RESTRICTION', 'Head · Ops · Supervisor · RM'], ['DECIDE_RESTRICTION', 'Head (VVIP) · Supervisor (Mass/HV) · RM (HNWI)'], ['CLOSE_UNRESPONSIVE', 'Head · Supervisor · RM'],
  ['CLEAR / RECLASSIFY_CAUTIONARY_NOTE', 'Compliance'], ['ADD / REMOVE_DNC', 'Compliance'], ['COLLECTIONS_CADENCE_EXCEPTION', 'Collections'], ['PROPOSE_POLICY_CHANGE', 'Head (all) · Credit (POL-03/04) · Supervisor (POL-01/02/06) · Compliance (POL-05/07/09/10) · Data Steward (POL-03 definitions)'], ['APPROVE_POLICY_CHANGE', 'Head (POL-01/02/03/08) · Credit (POL-04) · Supervisor (POL-06) · Compliance (POL-05/07/09/10)'],
];

export function SettingsScreen() {
  const { data, error } = useApi<any>('/settings');
  const { switchPersona, persona } = useApp();
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false); const [msg, setMsg] = useState('');
  if (error) return <Empty>{error}</Empty>;
  if (!data) return <p className="p-6 text-sm text-muted-foreground">Loading…</p>;
  return (
    <Screen hero={<Hero eyebrow="Settings" title="Personas, data, connectors, AI, the demo" lede="Switching persona changes the inbox, the scope, what is approvable and what Dalil will do; the data generator reads the DATA parameters, so a reset produces a base that matches QIB's." />} banner={false}>
      {msg ? <Note>{msg}</Note> : null}
      <PageColumns aside={<>
        <Panel icon={<Sparkles size={16} />} title="AI"><p className="flex items-center gap-2 text-sm"><StatusChip status={data.ai.mode} /><span>{data.ai.mode === 'claude' ? `Claude via ${data.ai.via}, model ${data.ai.model}` : 'Replit AI Integrations is not connected'}</span></p><p className="mt-2 text-[12px] text-muted-foreground">Five agents use Claude through Replit's Anthropic connection, for four kinds of work: Dalil's conversation, Mustaqbil's classification of free text, Fahis's reading of documents, and the drafts Munadi and Muwathiq prepare for a person. Everything that decides is deterministic. No API key is stored in the app; without the connection every Claude step has an Offline fallback and says so.</p></Panel>
        <Panel icon={<Network size={16} />} title="Connectors"><ul className="space-y-2">{data.connectors.map((c: any) => <li key={c.id} className="text-[12px]"><p className="flex items-center gap-2"><Chip tone={c.status === 'claude' || c.status === 'simulated' ? 'primary' : c.status === 'offline' || c.status === 'stubbed' ? 'warn' : undefined}>{c.status}</Chip><span className="font-medium">{c.name}</span></p><p className="text-muted-foreground">{c.note}</p></li>)}</ul><p className="mt-2 text-[11px] text-muted-foreground">Microsoft Graph needs {data.graph.needs.join(', ')} and application permissions Mail.Send and Mail.ReadWrite on a shared mailbox; it is one adapter swap, done after the first demo.</p></Panel>
      </>}>
        <Panel icon={<Users size={16} />} title="Personas">
          <Table><thead><tr><th>Persona</th><th>Role</th><th>Sees</th><th>Owns</th><th></th></tr></thead><tbody>{data.personas.map((p: any) => <tr key={p.key}><td><span className="flex items-center gap-2"><span className={`flex h-7 w-7 items-center justify-center rounded-full border text-[11px] font-semibold ${persona?.key === p.key ? 'border-primary bg-primary text-primary-foreground' : 'border-border'}`}>{p.initials}</span><span className="text-sm">{p.name} <span className="ar text-muted-foreground">{p.name_ar}</span></span></span></td><td className="text-[12px]">{p.role}</td><td className="text-[12px] text-muted-foreground">{p.sees}</td><td className="text-[12px]">{p.owns.join(', ') || '—'}</td><td><Btn small onClick={() => switchPersona(p.key)} disabled={persona?.key === p.key}>Act as</Btn></td></tr>)}</tbody></Table>
          <p className="eyebrow mt-4">Authority matrix</p>
          <Table className="mt-1"><thead><tr><th>Action</th><th>Who may</th></tr></thead><tbody>{MATRIX.map(([a, w]) => <tr key={a}><td className="font-mono text-[11px]">{a}</td><td className="text-[12px]">{w}</td></tr>)}</tbody></Table>
        </Panel>
        <Panel icon={<Presentation size={16} />} title="Demo · Present mode storylines">
          <p className="mb-3 text-[13px] text-muted-foreground">Present mode replaces the slides: card chapters are drawn by the app with live numbers, scenario chapters hand the room to the Director with the menu hidden, and each scenario is followed by a card with what it did, counted from the trail. Start it from the Present button in the title bar; → and ← move, F is full screen, Esc leaves.</p>
          <StorylineEditor />
        </Panel>
        <Panel icon={<Database size={16} />} title="Synthetic data (DATA parameters) · reset rebuilds the world from these">
          <Table><thead><tr><th>Parameter</th><th>Value</th><th>Basis</th></tr></thead><tbody>{data.data.map((p: any) => <tr key={p.key}><td><span className="block text-sm">{p.label}</span><span className="font-mono text-[11px] text-muted-foreground">{p.key}{p.unit ? ` · ${p.unit}` : ''}</span></td><td><input className="input h-8 w-64 font-mono text-[12px]" value={edits[p.key] ?? (Array.isArray(p.value) ? p.value.join(', ') : String(p.value))} onChange={(e) => setEdits({ ...edits, [p.key]: e.target.value })} /></td><td className="text-[11px] text-muted-foreground">{p.basis}</td></tr>)}</tbody></Table>
          <div className="mt-3 flex flex-wrap items-center gap-2"><Btn kind="danger" disabled={busy} onClick={async () => { if (!confirm('Rebuild the synthetic world with these distributions? About two minutes.')) return; setBusy(true); setMsg('Rebuilding…'); try { const params: any = {}; for (const p of data.data) { const v = edits[p.key]; if (v === undefined) continue; params[p.key] = p.type === 'number' ? Number(v) : p.type === 'list' ? v.split(',').map((s: string) => s.trim()) : v; } await post('/control/reset', { params: Object.keys(params).length ? { ...(await (await fetch('/api/policies')).json()).params.reduce((m: any, x: any) => { m[x.key] = x.stored ?? x.value; return m; }, {}), ...params } : undefined }); setMsg('Rebuilt. The clock is at today 09:00 Doha.'); bump(); } catch (e: any) { setMsg(e.message); } finally { setBusy(false); } }}>{busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}Reset the demo with these values</Btn><span className="text-[12px] text-muted-foreground">Seed {data.seed?.seed} · built {data.seed?.at ? new Date(data.seed.at).toLocaleString('en-GB') : '—'} · {num(2400)} customers by default</span></div>
        </Panel>
      </PageColumns>
    </Screen>
  );
}
