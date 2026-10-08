/** Documents — the examiner's queue and the document viewer with the extraction, the verification, the proposals and the checker's decision. */
import { useState } from 'react';
import { Panel, PageColumns } from '@cognirise/atelier/layout';
import { FileText, ShieldCheck } from 'lucide-react';
import { bump, useApi } from '../lib/api';
import { dateTime, num, title } from '../lib/format';
import { useApp, useFlash } from '../app/state';
import { Decide, Proposals, Recommendation } from '../app/case';
import { Chip, Empty, Hero, Kv, Note, Ref, Screen, SegChip, StatusChip, Table, Tabs, PERSONA_SHORT } from '../app/ui';

export function DocumentsScreen() {
  const { route } = useApp();
  if (route.param && /^\d+$/.test(route.param)) return <DocumentView id={Number(route.param)} />;
  return <Queue />;
}
function Queue() {
  const [tab, setTab] = useState('queue');
  const { data, error } = useApi<any[]>(`/documents?state=${tab === 'queue' ? 'queue' : tab === 'all' ? '' : tab}`, { poll: 12000 });
  const { go } = useApp();
  if (error) return <Empty>{error}</Empty>;
  const rows = data ?? [];
  return (
    <Screen hero={<Hero eyebrow="Documents · Fahis's queue" title={<>{num(rows.filter((d) => ['PROPOSED', 'REVIEW', 'REJECT_RECOMMENDED', 'RECEIVED'].includes(d.state)).length)} documents wait for a checker</>} lede="Every document is a specimen rendered from the synthetic record (or a real image uploaded in the customer app). Fahis extracts the fields (Claude, or Offline from the specimen's own data), verifies them against the record, scores confidence and assurance, and proposes the update. A person decides every one." />}>
      <Tabs value={tab} onChange={setTab} tabs={[{ id: 'queue', label: 'Waiting for a checker' }, { id: 'APPLIED', label: 'Applied' }, { id: 'REJECTED', label: 'Rejected' }, { id: 'all', label: 'All' }]} />
      <Panel icon={<FileText size={16} />} title={`${num(rows.length)} document(s)`}>
        <Table><thead><tr><th>Document</th><th>Customer</th><th>Type</th><th>Received</th><th>Assurance</th><th>Fahis</th><th>Confidence</th><th>State</th><th>Waits on</th></tr></thead>
          <tbody>{rows.map((d) => <DocRow key={d.id} d={d} onOpen={() => go('documents', String(d.id))} />)}</tbody></Table>
        {!rows.length ? <Empty>Nothing here.</Empty> : null}
      </Panel>
    </Screen>
  );
}
function DocRow({ d, onOpen }: { d: any; onOpen: () => void }) {
  const flash = useFlash('documents', d.id, true);
  return (
    <tr className={`clickable ${flash}`} onClick={onOpen}>
      <td className="font-mono text-[12px]">#{d.id}{d.case_ref ? <span className="block text-muted-foreground">{d.case_ref}</span> : null}</td>
      <td><span className="block text-sm">{d.name_en}</span><span className="flex items-center gap-1 font-mono text-[11px] text-muted-foreground">{d.customer_id} <SegChip s={d.segment} /></span></td>
      <td><Chip>{d.type}</Chip></td><td className="text-[12px]">{dateTime(d.received_at)}</td><td><Chip>{title(d.assurance)}</Chip></td>
      <td>{d.recommendation ? <Chip tone={d.recommendation === 'APPROVE' ? 'success' : d.recommendation === 'REJECT' ? 'danger' : 'warn'}>{d.recommendation.toLowerCase()}</Chip> : '—'}{d.mode ? <StatusChip status={d.mode} className="ms-1" /> : null}</td>
      <td className="font-mono text-[12px]">{d.overall_confidence ? Number(d.overall_confidence).toFixed(2) : '—'}</td>
      <td><StatusChip status={d.state} />{(d.flags ?? []).slice(0, 2).map((f: string) => <Chip key={f} tone="danger" className="ms-1">{f.replace(/_/g, ' ').toLowerCase()}</Chip>)}</td>
      <td className="text-[12px]">{d.waiting_on ? PERSONA_SHORT[d.waiting_on] : '—'}</td>
    </tr>
  );
}

export function DocumentView({ id }: { id: number }) {
  const { go, openCase, open, persona } = useApp();
  const { data: d, error, reload } = useApi<any>(`/documents/${id}`);
  const flash = useFlash('documents', id);
  if (error) return <Screen hero={<Hero eyebrow="Document" title={`#${id}`} />}><Empty>{error}</Empty></Screen>;
  if (!d) return <p className="p-6 text-sm text-muted-foreground">Loading…</p>;
  const ex = d.extracted ?? {}; const ver = d.verification ?? {};
  const rec = d.record;
  const compare: [string, any, any][] = d.type === 'QID' || d.type === 'PASSPORT'
    ? [['Name', ex.name_en, rec.nameEn], ['Number', ex.number, d.type === 'QID' ? rec.qidNumber : rec.passportNumber], ['Date of birth', ex.dob, rec.dob], ['Nationality', ex.nationality, rec.nationality], ['Expires', ex.expires_on, d.type === 'QID' ? rec.qidExpiry : rec.passportExpiry]]
    : d.type === 'SALARY_CERT' ? [['Name', ex.name_en, rec.nameEn], ['Employer', ex.employer, rec.employerName ?? '— (none on record)'], ['Salary total', ex.salary_total, rec.salaryTotal], ['Paid to', ex.paid_to_bank, 'QIB'], ['Dated', ex.dated, '≤ 30 days']]
    : d.type === 'HR_LETTER' ? [['Employer', ex.employer, rec.employerName], ['Gap month', ex.gap_month, '—'], ['Reason', ex.reason, 'on the acceptable list?'], ['Continuous', String(ex.continuous), '—']]
    : Object.entries(ex).filter(([k]) => !['orders', 'credits', 'mrz1', 'mrz2'].includes(k)).slice(0, 8).map(([k, v]) => [title(k), typeof v === 'object' ? JSON.stringify(v) : v, '—'] as [string, any, any]);
  const mine = d.run && (d.run.status === 'WAITING' || d.run.status === 'ESCALATED') && d.run.waiting_on_persona === persona?.key;
  return (
    <Screen hero={<Hero eyebrow={<span className="flex items-center gap-2">Document #{d.id} · {d.type} {d.case_ref ? <Ref>{d.case_ref}</Ref> : null}</span>} title={<span className={flash}>{d.name_en} <span className="ar text-muted-foreground">{d.name_ar}</span></span>} lede={<span className="flex flex-wrap items-center gap-2"><StatusChip status={d.state} /><Chip>{title(d.assurance)}</Chip>{d.mode ? <StatusChip status={d.mode} /> : null}<span>received {dateTime(d.received_at)}{d.examined_at ? ` · examined ${dateTime(d.examined_at)}` : ''}</span>{d.specimen?.flaw ? <Chip tone="danger">specimen flaw: {d.specimen.flaw.replace(/_/g, ' ').toLowerCase()}</Chip> : null}</span>}
      actions={<div className="flex flex-wrap gap-2"><button type="button" className="pill-btn pill-btn-ghost" onClick={() => go('documents')}>Queue</button>{d.case_ref ? <button type="button" className="pill-btn pill-btn-ghost" onClick={() => openCase(d.case_ref)}>Open the case</button> : null}<button type="button" className="pill-btn pill-btn-ghost" onClick={() => open(`customer:${d.customer_id}`)}>Customer 360</button></div>} />}>
      {d.specimen ? <Note>Specimen: {d.specimen.title}. Synthetic, watermarked, rendered from the record so the Offline examiner can read it; with Claude connected, Fahis extracts from the document's printed text (or from the image, for a real upload).</Note> : null}
      <PageColumns aside={<>
        <Panel icon={<ShieldCheck size={16} />} title="Verification (POL-06)">
          <ul className="space-y-1.5 text-[13px]">{Object.entries(ver).map(([k, v]: any) => <li key={k} className="flex items-start gap-2">{v.ok ? <Chip tone="success">ok</Chip> : <Chip tone="danger">fail</Chip>}<span><span className="font-mono text-[11px] text-muted-foreground">{k.replace(/_/g, ' ').toLowerCase()}</span><br />{v.note}</span></li>)}</ul>
          <dl className="mt-3 grid grid-cols-2 gap-3"><Kv k="Overall confidence" v={<span className="font-mono">{d.overall_confidence ? Number(d.overall_confidence).toFixed(2) : '—'}</span>} /><Kv k="Recommendation" v={d.recommendation ? <Chip tone={d.recommendation === 'APPROVE' ? 'success' : d.recommendation === 'REJECT' ? 'danger' : 'warn'}>{d.recommendation.toLowerCase()}</Chip> : '—'} /></dl>
          {d.proposals.some((p: any) => p.one_click) ? <p className="mt-2 text-[12px] text-success">Confidence at or above the one-click threshold: the checker sees before/after and approves in one click [POL-06 §1.3].</p> : <p className="mt-2 text-[12px] text-muted-foreground">Below the one-click threshold or flagged: full comparison for the checker.</p>}
        </Panel>
        {mine ? <Panel title="Your decision"><Recommendation run={d.run} /><div className="mt-2"><Decide run={d.run} onDone={() => { bump(); reload(); }} /></div></Panel> : d.run ? <Panel title="Decision"><p className="text-[13px] text-muted-foreground">Waits on {PERSONA_SHORT[d.run.waiting_on_persona] ?? d.run.waiting_on_persona}. Switch persona to decide.</p></Panel> : null}
      </>}>
        <Panel icon={<FileText size={16} />} title="The document">
          <div className="overflow-hidden rounded-xl border border-border/60 bg-white"><img src={d.image_ref} alt={`${d.type} specimen`} className="w-full" /></div>
          {d.specimen?.text ? <details className="mt-2 text-[12px]"><summary className="cursor-pointer text-muted-foreground">Printed text (what the Claude examiner reads for a specimen)</summary><pre className="mt-1 whitespace-pre-wrap rounded-lg bg-muted/40 p-2 font-mono text-[11px]">{d.specimen.text}</pre></details> : null}
        </Panel>
        <Panel icon={<ShieldCheck size={16} />} title="Extracted vs the record">
          <Table><thead><tr><th>Field</th><th>On the document</th><th>On the record</th><th>Confidence</th></tr></thead><tbody>{compare.map(([k, a, b]) => <tr key={k}><td>{k}</td><td className="font-medium">{String(a ?? '—')}</td><td className="text-muted-foreground">{String(b ?? '—')}</td><td className="font-mono text-[12px]">{(() => { const key = Object.keys(ex).find((x) => String(ex[x]) === String(a)); return key && d.confidence?.[key] ? Number(d.confidence[key]).toFixed(2) : '—'; })()}</td></tr>)}</tbody></Table>
          {ex.mrz2 ? <p className="mt-2 font-mono text-[11px] text-muted-foreground">MRZ {ex.mrz1}<br />{ex.mrz2}</p> : null}
          {ex.orders ? <p className="mt-2 text-[12px]">Declared: {ex.orders.map((o: any) => `order ${o.index} → ${o.declared}`).join(' · ')}</p> : null}
        </Panel>
        <Panel icon={<ShieldCheck size={16} />} title="Proposed updates (Fahis proposes, the checker decides, Muhaddith writes)">{d.proposals.length ? <Proposals rows={d.proposals} /> : <p className="text-[13px] text-muted-foreground">No update proposed{d.recommendation === 'REJECT' ? ': the document was recommended for rejection' : ''}.</p>}</Panel>
      </PageColumns>
    </Screen>
  );
}
