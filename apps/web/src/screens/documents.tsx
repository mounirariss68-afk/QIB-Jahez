/**
 * Documents — "Can I approve what Fahis read in one click?" (Operations
 * Supervisor). The same shape as the Inbox: the tabs, the list on the left,
 * the document read and decided on the right, the decision pinned at the foot
 * and the body scrolling above it. The headline says what Fahis read and at
 * what confidence; the confidence against the one-click threshold is the
 * picture; what changes on the record and the checks are the facts; the
 * document beside what it says against the record. The verification notes,
 * the proposals table, the printed text and the ids are behind "How this was
 * checked".
 */
import { useState, type ReactNode } from 'react';
import { InboxItem, InboxLayout, InboxList, InboxReader, InboxTabs, Provenance, ReaderSection } from '@cognirise/cognipulse/archetypes';
import { FigureTile, Segments } from '@cognirise/cognipulse/viz';
import { bump, useApi } from '../lib/api';
import { dateTime, rel, title } from '../lib/format';
import { useApp, useFlash } from '../app/state';
import { usePresent } from '../app/present';
import { Decide, Proposals, Recommendation, plainProposal } from '../app/case';
import { Confidence } from '../app/viz';
import { Chip, Empty, SEG, StatusChip, Table, DOC_LABEL, PERSONA_SHORT } from '../app/ui';

type Tab = 'queue' | 'APPLIED' | 'REJECTED' | 'all';
const WAITING = ['PROPOSED', 'REVIEW', 'REJECT_RECOMMENDED', 'RECEIVED'];
const pct = (v: any) => v == null ? null : Math.round(Number(v) * 100);
const first = (name: string) => String(name ?? '').split(' ')[0];
const docWord = (t: string) => DOC_LABEL[t] ?? title(t);
const ASSURANCE: Record<string, string> = { APP_UPLOAD: 'uploaded in the app', RM_SCAN: 'collected by the relationship manager', EMAIL: 'sent by e-mail', BRANCH: 'scanned at a branch' };

export function DocumentsScreen() {
  const { route, go, session, director } = useApp();
  const { present } = usePresent();
  const [tab, setTab] = useState<Tab>('queue');
  const { data, error } = useApi<any[]>(`/documents?state=${tab === 'queue' ? 'queue' : tab === 'all' ? '' : tab}`, { poll: 12000 });
  const { data: queue } = useApi<any[]>('/documents?state=queue', { poll: 12000 });
  const now: string = session?.clock.now ?? new Date().toISOString();
  if (error) return <Empty>{error}</Empty>;
  const rows = data ?? [];
  const asked = route.param && /^\d+$/.test(route.param) ? Number(route.param) : null;
  const selected = asked ?? rows[0]?.id ?? null;
  const waiting = (queue ?? []).length;
  const height = director || present ? 'lg:h-[calc(100dvh-21rem)]' : 'lg:h-[calc(100dvh-7.75rem)]';
  return (
    <InboxLayout className={height}
      tabs={<div className="flex flex-wrap items-center gap-x-5 gap-y-2"><h1 className="text-lg font-semibold">Documents</h1>
        <InboxTabs value={tab} onChange={(id) => { setTab(id as Tab); go('documents'); }} items={[{ id: 'queue', label: 'Waiting for a checker', count: waiting, tone: 'attention' }, { id: 'APPLIED', label: 'Applied' }, { id: 'REJECTED', label: 'Rejected' }, { id: 'all', label: 'All' }]} /></div>}
      list={
        <InboxList label={tab === 'queue' ? 'Read by Fahis, waiting for a checker' : tab === 'all' ? 'Every document' : title(tab)} count={rows.length} emptyState={<Empty>{tab === 'queue' ? 'Nothing waits for a checker.' : 'Nothing here.'}</Empty>}>
          {rows.map((d) => <DocItem key={d.id} d={d} now={now} active={d.id === selected} onSelect={() => go('documents', String(d.id))} />)}
        </InboxList>}
      reader={selected ? <DocumentView key={selected} id={selected} /> : <InboxReader empty="When a customer sends a document, Fahis reads it and it waits here for a checker." />} />
  );
}

/** A row: the customer, the document and its read confidence, the state; the ids travel in the hover. */
function DocItem({ d, now, active, onSelect }: { d: any; now: string; active: boolean; onSelect: () => void }) {
  const flash = useFlash('documents', d.id, true);
  const c = pct(d.overall_confidence);
  const flagged = (d.flags ?? []).length > 0;
  return (
    <div className={flash} title={`Document ${d.id}${d.case_ref ? ` · ${d.case_ref}` : ''} · ${d.customer_id}`}>
      <InboxItem selected={active} onSelect={onSelect} title={d.name_en}
        preview={`${docWord(d.type).replace(/^[a-z]/, (x) => x.toUpperCase())}${c !== null ? ` read at ${c}%` : ', not read yet'}${flagged ? ` · ${String(d.flags[0]).replace(/_/g, ' ').toLowerCase()}` : ''}`}
        reference={<span className="text-[11px] text-muted-foreground">{SEG[d.segment] ?? ''} · {rel(d.received_at, now)}</span>}
        state={WAITING.includes(d.state) ? (d.recommendation === 'REJECT' || flagged ? <Chip tone="danger">reject recommended</Chip> : d.waiting_on ? <Chip tone="warn">waits on {PERSONA_SHORT[d.waiting_on] ?? d.waiting_on}</Chip> : <StatusChip status={d.state} />) : <StatusChip status={d.state} />} />
    </div>
  );
}

/** The document, decision first. Also the deep link #/documents/<id>. */
export function DocumentView({ id }: { id: number }) {
  const { openCase, open, persona } = useApp();
  const { data: d, error, reload } = useApi<any>(`/documents/${id}`);
  const flash = useFlash('documents', id);
  if (error) return <InboxReader className="h-full"><Empty>{error}</Empty></InboxReader>;
  if (!d) return <InboxReader className="h-full"><p className="text-sm text-muted-foreground">Loading…</p></InboxReader>;
  const ex = d.extracted ?? {}; const ver: Record<string, any> = d.verification ?? {};
  const rec = d.record ?? {};
  const threshold = Number(d.threshold ?? 0.95);
  const conf = d.overall_confidence != null ? Number(d.overall_confidence) : null;
  const c = pct(conf);
  const mine = d.run && (d.run.status === 'WAITING' || d.run.status === 'ESCALATED') && d.run.waiting_on_persona === persona?.key;
  const props = (d.proposals ?? []) as any[];
  const pending = props.filter((p) => p.state === 'PROPOSED');
  const oneClick = props.some((p) => p.one_click);
  const checks = Object.entries(ver).map(([k, v]: any) => ({ key: k, label: k.replace(/_/g, ' ').toLowerCase().replace(/^[a-z]/, (x: string) => x.toUpperCase()), ok: !!v?.ok, note: v?.note }));
  const failed = checks.filter((x) => !x.ok);
  const compare: [string, any, any][] = d.type === 'QID' || d.type === 'PASSPORT'
    ? [['Name', ex.name_en, rec.nameEn], ['Number', ex.number, d.type === 'QID' ? rec.qidNumber : rec.passportNumber], ['Date of birth', ex.dob, rec.dob], ['Nationality', ex.nationality, rec.nationality], ['Expires', ex.expires_on, d.type === 'QID' ? rec.qidExpiry : rec.passportExpiry]]
    : d.type === 'SALARY_CERT' ? [['Name', ex.name_en, rec.nameEn], ['Employer', ex.employer, rec.employerName ?? 'none on the record'], ['Salary total', ex.salary_total, rec.salaryTotal], ['Paid to', ex.paid_to_bank, 'QIB'], ['Dated', ex.dated, 'within 30 days']]
    : d.type === 'HR_LETTER' ? [['Employer', ex.employer, rec.employerName], ['Gap month', ex.gap_month, '—'], ['Reason', ex.reason, 'on the acceptable list?'], ['Continuous', String(ex.continuous), '—']]
    : Object.entries(ex).filter(([k]) => !['orders', 'credits', 'mrz1', 'mrz2'].includes(k)).slice(0, 8).map(([k, v]) => [title(k), typeof v === 'object' ? JSON.stringify(v) : v, '—'] as [string, any, any]);
  const differs = (a: any, b: any) => a != null && b != null && String(a).trim().toLowerCase() !== String(b).trim().toLowerCase() && !['—', 'QIB', 'within 30 days', 'on the acceptable list?'].includes(String(b));

  const whose = d.run && (d.run.status === 'WAITING' || d.run.status === 'ESCALATED') ? (mine ? 'waiting on you' : `waiting on the ${PERSONA_SHORT[d.run.waiting_on_persona] ?? d.run.waiting_on_persona}`) : lc(StatusWord(d.state));
  const headline = c === null ? `${first(d.name_en)}'s ${docWord(d.type)} has not been read yet`
    : WAITING.includes(d.state) ? `Fahis read ${first(d.name_en)}'s ${docWord(d.type)} at ${c}%; ${oneClick && !failed.length ? 'it can be approved in one click' : failed.length ? `${failed.length === 1 ? 'one check fails' : `${failed.length} checks fail`}, so it needs a full look` : `below the ${Math.round(threshold * 100)}% for one click, so it needs a full look`}`
    : `${first(d.name_en)}'s ${docWord(d.type)}, read at ${c}%, was ${d.state === 'APPLIED' ? 'applied to the record' : d.state === 'REJECTED' ? 'rejected' : lc(StatusWord(d.state))}`;

  const header = (
    <header className={flash}>
      <p className="flex flex-wrap items-center gap-x-1.5 text-[12px] text-muted-foreground" title={`Document ${d.id}${d.case_ref ? ` · ${d.case_ref}` : ''} · ${d.customer_id}`}>
        <span>{docWord(d.type).replace(/^[a-z]/, (x) => x.toUpperCase())}, {ASSURANCE[d.assurance] ?? lc(title(d.assurance))}</span><span>·</span>
        <button type="button" className="font-medium text-foreground hover:text-primary" onClick={() => open(`customer:${d.customer_id}`)} title="Open the customer record">{d.name_en}</button><span>·</span>
        <span>{SEG[d.segment] ?? d.segment}</span><span>·</span>
        <span className={mine ? 'text-warn' : undefined}>{whose}</span>
        {d.case_ref ? <><span>·</span><button type="button" className="text-primary" onClick={() => openCase(d.case_ref)}>the case</button></> : null}
      </p>
      <h2 className="mt-1.5 text-lg font-semibold leading-snug tracking-tight">{headline}</h2>
    </header>
  );

  const facts: ReactNode[] = [
    <FigureTile key="conf" label={`Read confidence, against ${Math.round(threshold * 100)}% for one click`} value={c === null ? 'Not read yet' : `${c}%${conf !== null && conf >= threshold ? ', above' : ', below'}`}><Confidence value={conf} threshold={threshold} /></FigureTile>,
    <FigureTile key="change" label="What changes on the record" value={pending.length ? plainProposal(pending[0]) : props.length ? plainProposal(props[0]) : d.recommendation === 'REJECT' ? 'Nothing: rejection recommended' : 'Nothing proposed'} sub={pending.length > 1 ? `and ${pending.length - 1} more` : undefined} />,
  ];
  if (checks.length) facts.push(
    <FigureTile key="checks" label="Fahis's checks" value={failed.length ? `${checks.length - failed.length} of ${checks.length} pass` : `All ${checks.length} pass`}>
      <Segments items={checks.map((x) => ({ label: `${x.label}${x.note ? `: ${x.note}` : ''}`, on: x.ok }))} />
      {failed.length ? <p className="mt-1.5 text-[12px] font-medium leading-snug text-danger">{failed.map((x) => x.label).join(' · ')}</p> : null}
    </FigureTile>,
  );

  const body = (
    <div className="space-y-3">
      <div className={`grid gap-3 ${facts.length >= 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-2'}`}>{facts}</div>
      {d.run?.result?.recommendation ? <Recommendation run={d.run} /> : d.recommendation ? <p className={`border-s-2 ps-3 text-sm ${d.recommendation === 'APPROVE' ? 'border-success' : d.recommendation === 'REJECT' ? 'border-danger' : 'border-warn'}`}><span className="font-semibold">Fahis recommends {d.recommendation === 'APPROVE' ? 'approving' : d.recommendation === 'REJECT' ? 'rejecting' : 'a closer look'}.</span>{failed.length ? ` ${failed.map((x) => x.note).filter(Boolean).join('; ')}` : ''}</p> : null}
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <div className="overflow-hidden rounded-xl border border-border/60 bg-white"><img src={d.image_ref} alt={`${docWord(d.type)} specimen`} className="w-full" /></div>
        <div className="rounded-xl glass-l3 px-4 py-3">
          <p className="text-[12px] text-muted-foreground">What it says, against the record</p>
          <Table className="mt-1"><thead><tr><th></th><th>On the document</th><th>On the record</th></tr></thead>
            <tbody>{compare.map(([k, a, b]) => <tr key={k}><td className="text-[12px] text-muted-foreground">{k}</td><td className={`text-[13px] font-medium ${differs(a, b) && k !== 'Expires' ? 'text-danger' : ''}`}>{String(a ?? '—')}</td><td className="text-[13px] text-muted-foreground">{String(b ?? '—')}</td></tr>)}</tbody></Table>
          {ex.orders ? <p className="mt-2 text-[12px]">Declared: {ex.orders.map((o: any) => `order ${o.index} → ${o.declared}`).join(' · ')}</p> : null}
        </div>
      </div>
      <Provenance label="How this was checked" className="mt-0">
        {checks.length ? <ReaderSection label="Fahis's checks"><ul className="space-y-1.5 text-[13px]">{checks.map((x) => <li key={x.key} className="flex items-start gap-2">{x.ok ? <Chip tone="success">passes</Chip> : <Chip tone="danger">fails</Chip>}<span><span className="font-medium">{x.label}</span>{x.note ? <span className="text-muted-foreground"> · {x.note}</span> : null}</span></li>)}</ul></ReaderSection> : null}
        {props.length ? <ReaderSection label="The proposed updates (Fahis proposes, the checker decides, Muhaddith writes)"><Proposals rows={props} /></ReaderSection> : null}
        {d.specimen ? <ReaderSection label="The specimen"><p className="text-[12px] text-muted-foreground">{d.specimen.title}: synthetic and watermarked, drawn from the record so the examiner can read it{d.specimen.flaw ? `; its planted flaw: ${String(d.specimen.flaw).replace(/_/g, ' ').toLowerCase()}` : ''}.</p>{d.specimen.text ? <pre className="mt-1 whitespace-pre-wrap rounded-lg bg-muted/40 p-2 font-mono text-[11px]">{d.specimen.text}</pre> : null}</ReaderSection> : null}
        {ex.mrz2 ? <p className="font-mono text-[11px] text-muted-foreground">MRZ {ex.mrz1}<br />{ex.mrz2}</p> : null}
        <p className="text-[11px] text-muted-foreground">Document {d.id} · customer {d.customer_id}{d.case_ref ? ` · case ${d.case_ref}` : ''} · received {dateTime(d.received_at)}{d.examined_at ? ` · read ${dateTime(d.examined_at)}` : ''}{d.mode ? ` · ${d.mode === 'claude' ? 'read with Claude' : 'read offline'}` : ''}</p>
      </Provenance>
    </div>
  );
  const actions = mine ? <Decide run={d.run} onDone={() => { bump(); reload(); }} /> : undefined;
  return <InboxReader className="case-reader h-full" header={header} actions={actions}>{body}</InboxReader>;
}

const lc = (s: string) => String(s ?? '').replace(/^[A-Z](?=[a-z])/, (x) => x.toLowerCase());
const StatusWord = (s: string) => ({ APPLIED: 'Applied', REJECTED: 'Rejected', RECEIVED: 'Received', PROPOSED: 'Proposed', REVIEW: 'Needs review', REJECT_RECOMMENDED: 'Reject recommended', APPROVED: 'Approved' } as Record<string, string>)[s] ?? title(s);
