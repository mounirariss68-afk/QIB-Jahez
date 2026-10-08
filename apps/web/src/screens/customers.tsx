/** Customers — the synthetic client data, the 360, and the employer register. */
import { useEffect, useMemo, useState } from 'react';
import { Panel, PanelAction, PageColumns, StatRow, StatTile } from '@cognirise/atelier/layout';
import { ProvenanceChip } from '@cognirise/atelier/archetypes';
import { Building2, CreditCard, FileText, Landmark, Search, ShieldCheck, Smartphone, UserRound, Wallet } from 'lucide-react';
import { bump, post, useApi } from '../lib/api';
import { date, dateTime, maskQid, month, num, qar, title } from '../lib/format';
import { useApp, useFlash } from '../app/state';
import { TrailList, Messages, Proposals, Decide, Recommendation } from '../app/case';
import { Btn, Chip, ClassChip, Empty, Hero, Kv, Note, ReasonChip, Ref, Screen, SegChip, SourceStamp, StatusChip, Table, Tabs, Select, PERSONA_SHORT } from '../app/ui';

const parseParam = (p: string | null) => { const o: Record<string, string> = {}; if (!p) return o; if (!p.includes('=')) return { id: p }; for (const kv of p.split('&')) { const [k, v] = kv.split('='); o[k] = decodeURIComponent(v ?? ''); } return o; };

export function CustomersScreen() {
  const { route } = useApp();
  const p = parseParam(route.param);
  if (p.id) return <Customer360 id={p.id} />;
  return <CustomerList init={p} />;
}

function CustomerList({ init }: { init: Record<string, string> }) {
  const { go, persona } = useApp();
  const [q, setQ] = useState(init.q ?? ''); const [segment, setSegment] = useState(init.segment ?? ''); const [reason, setReason] = useState(init.reason ?? ''); const [cls, setCls] = useState(init.cls ?? ''); const [eligible, setEligible] = useState(init.eligible ?? ''); const [page, setPage] = useState(0);
  useEffect(() => { setSegment(init.segment ?? ''); setReason(init.reason ?? ''); setCls(init.cls ?? ''); setEligible(init.eligible ?? ''); setQ(init.q ?? ''); setPage(0); }, [init.segment, init.reason, init.cls, init.eligible, init.q]);
  const qs = new URLSearchParams({ q, segment, reason, cls, eligible, page: String(page), size: '40' }).toString();
  const { data, error } = useApi<any>(`/customers?${qs}`);
  const { data: reasons } = useApi<any>('/reasons');
  if (persona?.scope?.metricsOnly) return <Screen hero={<Hero eyebrow="Customers" title="Metrics only" lede="The Data Steward sees field-level metrics and definitions; customer records are not in scope. Use Data health." />}><Empty>Drill-downs show DEMO ids only, never a record.</Empty></Screen>;
  return (
    <Screen hero={<Hero eyebrow="Customers · the synthetic base" title={<>{num(data?.total)} customers{segment ? ` · ${title(segment)}` : ''}{reason ? ` · ${reason}` : ''}</>} lede="Every record is generated; the eligibility shown is the last scan's result under the active policy. Open a customer for the 360: the record, the twenty rules with pass/fail, the case, the messages, the documents and the trail." />}>
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative"><Search className="pointer-events-none absolute start-3 top-2.5 h-4 w-4 text-muted-foreground" /><input className="input ps-9" placeholder="Name, DEMO id, RIM, employer" value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} /></div>
        <Select value={segment} onChange={(v) => { setSegment(v); setPage(0); }}><option value="">All segments</option><option value="VVIP">VVIP</option><option value="HNWI">HNWI</option><option value="HIGH_VALUE">High Value</option><option value="MASS">Mass</option></Select>
        <Select value={eligible} onChange={(v) => { setEligible(v); setPage(0); }}><option value="">Eligible and not</option><option value="yes">Eligible</option><option value="no">Not eligible</option></Select>
        <Select value={cls} onChange={(v) => { setCls(v); setPage(0); }}><option value="">All classes</option><option value="A">A · ask the customer</option><option value="B">B · bank must act</option><option value="C">C · not eligible by policy</option><option value="D">D · collections boundary</option></Select>
        <Select value={reason} onChange={(v) => { setReason(v); setPage(0); }}><option value="">All reasons</option>{(reasons?.reasons ?? []).map((r: any) => <option key={r.code} value={r.code}>{r.code} {r.label}</option>)}</Select>
      </div>
      {error ? <Empty>{error}</Empty> : null}
      <Panel icon={<UserRound size={16} />} title={`${num(data?.total ?? 0)} customers`} action={<span className="text-[12px] text-muted-foreground">page {page + 1} of {Math.max(1, Math.ceil((data?.total ?? 0) / 40))}</span>}>
        <Table>
          <thead><tr><th>Customer</th><th>Segment</th><th>Employer</th><th>Salary</th><th>Eligible</th><th>Reasons</th><th>Case</th></tr></thead>
          <tbody>{(data?.rows ?? []).map((r: any) => <CustomerRow key={r.id} r={r} onOpen={() => go('customers', r.id)} />)}</tbody>
        </Table>
        <div className="mt-3 flex items-center gap-2"><Btn small onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0}>Previous</Btn><Btn small onClick={() => setPage((p) => p + 1)} disabled={(page + 1) * 40 >= (data?.total ?? 0)}>Next</Btn></div>
      </Panel>
    </Screen>
  );
}
function CustomerRow({ r, onOpen }: { r: any; onOpen: () => void }) {
  const flash = useFlash('customers', r.id, true);
  return (
    <tr className={`clickable ${flash}`} onClick={onOpen}>
      <td><span className="block text-sm font-medium">{r.name_en}</span><span className="block font-mono text-[11px] text-muted-foreground">{r.id} · {r.is_qatari ? 'QAT' : r.nationality}{r.status !== 'NORMAL' ? ` · ${title(r.status)}` : ''}</span></td>
      <td><SegChip s={r.segment} /></td><td className="text-[12px]">{r.employer ?? <span className="text-muted-foreground">none on record</span>}{r.employer_status && r.employer_status !== 'APPROVED' ? <Chip tone="warn" className="ms-1">{title(r.employer_status)}</Chip> : null}</td>
      <td className="font-mono text-[12px]">{qar(r.salary_total)}</td>
      <td>{r.eligible ? <Chip tone="success">{qar(r.amount)}</Chip> : <ClassChip cls={r.cls} />}</td>
      <td><span className="flex flex-wrap gap-1">{(r.reason_codes ?? []).map((c: string) => <ReasonChip key={c} code={c} />)}</span></td>
      <td className="text-[12px]">{r.case_ref ? <><Ref>{r.case_ref}</Ref> <StatusChip status={r.case_state} /></> : <span className="text-muted-foreground">—</span>}</td>
    </tr>
  );
}

export function Customer360({ id }: { id: string }) {
  const { go, open, openCase, persona } = useApp();
  const { data: d, error, reload } = useApi<any>(`/customers/${id}`);
  const [tab, setTab] = useState('record');
  const [msg, setMsg] = useState('');
  const flash = useFlash('customers', id);
  if (error) return <Screen hero={<Hero eyebrow="Customer" title={id} />}><Empty>{error}</Empty></Screen>;
  if (!d) return <p className="p-6 text-sm text-muted-foreground">Loading…</p>;
  const c = d.customer, q = d.qualification;
  const openK = d.cases.find((k: any) => k.state !== 'CLOSED');
  const failed = q.checks.filter((x: any) => !x.pass);
  return (
    <Screen hero={<Hero eyebrow={<span className="flex items-center gap-2">Customer 360 <Ref>{c.id}</Ref> <ProvenanceChip kind="synthetic" /></span>} title={<span className={flash}>{c.nameEn} <span className="ar text-muted-foreground">{c.nameAr}</span></span>}
      lede={<span className="flex flex-wrap items-center gap-2"><SegChip s={c.segment} /><span>{c.is_qatari ? 'Qatari national' : `Resident · ${c.nationality}`}</span><StatusChip status={c.status} /><span>· RIM {c.rim_no} · joined {date(c.joined_on)}</span>{d.rm ? <span>· RM {d.rm.name_en}</span> : null}{c.card_restricted ? <Chip tone="danger">cards restricted</Chip> : null}</span>}
      actions={<div className="flex flex-wrap gap-2">{openK ? <Btn kind="primary" onClick={() => openCase(openK.ref)}>Open case {openK.ref}</Btn> : null}<Btn onClick={() => go('customer-app', c.id)}>The customer's phone</Btn><Btn onClick={() => go('comms', `mailbox=${c.id}`)}>Mailbox</Btn>{d.can.rerun ? <Btn onClick={async () => { try { const r = await post(`/customers/${c.id}/requalify`); setMsg(r.eligible ? `Eligible: ${qar(r.amount)} — hand-off started` : `Still not eligible: ${r.reasons.join(', ')}`); bump(); reload(); } catch (e: any) { setMsg(e.message); } }}>Re-run the check</Btn> : null}</div>}
      feature={<div className={`rounded-2xl border p-4 ${q.eligible ? 'border-success/40 bg-success/5' : 'border-border/60 bg-card/60'}`}><p className="eyebrow">One Click today</p>{q.eligible ? <><p className="mt-1 text-2xl font-extrabold tabular-nums">{qar(q.amount)}</p><p className="text-[12px] text-muted-foreground">over {q.inputs.tenor} months{q.eligibleVehicle ? '' : ' · vehicle finance excluded (R20)'}</p></> : <><p className="mt-1 text-lg font-bold">Not eligible <ClassChip cls={q.cls} /></p><p className="flex flex-wrap gap-1 pt-1">{q.reasons.map((r: string) => <ReasonChip key={r} code={r} />)}</p></>}</div>} />}>
      {msg ? <Note>{msg}</Note> : null}
      <StatRow>
        <StatTile label="DBR base" value={qar(q.inputs.dbrBase)} state={<Chip>{q.inputs.dbrPct}%</Chip>} trend={{ direction: 'flat', label: c.is_qatari ? 'basic + social allowance' : 'total salary', sentiment: 'neutral' }} />
        <StatTile label="Obligations / capacity" value={`${qar(q.inputs.obligations)} / ${qar(q.inputs.capacity)}`} trend={{ direction: 'flat', label: `standing orders counted ${qar(q.inputs.standingOrdersCounted)}`, sentiment: 'neutral' }} />
        <StatTile label="Headroom under the cap" value={qar(q.inputs.headroom)} trend={{ direction: 'flat', label: `exposure ${qar(q.inputs.exposure)} of ${qar(q.inputs.cap)}`, sentiment: q.inputs.headroom > 0 ? 'good' : 'bad' }} />
        <StatTile label="Tenor" value={`${q.inputs.tenor} months`} trend={{ direction: 'flat', label: `${q.inputs.monthsToAgeLimit} months to the age limit`, sentiment: 'neutral' }} />
      </StatRow>
      <Tabs value={tab} onChange={setTab} tabs={[{ id: 'record', label: 'Record' }, { id: 'rules', label: 'The twenty rules', n: failed.length }, { id: 'cases', label: 'Cases', n: d.cases.length }, { id: 'comms', label: 'Messages', n: d.messages.length }, { id: 'docs', label: 'Documents', n: d.documents.length }, { id: 'trail', label: 'Trail', n: d.trail.length }]} />
      {tab === 'record' ? (
        <PageColumns aside={<>
          <Panel icon={<Smartphone size={16} />} title="Contact and consent"><dl className="grid grid-cols-2 gap-3"><Kv k="Mobile" v={d.contact?.mobile} mono /><Kv k="E-mail" v={d.contact?.email} /><Kv k="App" v={d.contact?.app_registered ? `registered · push ${d.contact.push_enabled ? 'on' : 'off'} · last login ${date(d.contact.last_app_login)}` : 'not registered'} /><Kv k="Language" v={c.language_pref === 'ar' ? 'Arabic' : 'English'} /><Kv k="Marketing consent" v={d.consent.marketing_consent ? <Chip tone="success">yes</Chip> : <Chip tone="warn">no — offers blocked</Chip>} /><Kv k="Channel opt-outs" v={d.consent.channel_optouts?.length ? d.consent.channel_optouts.join(', ') : 'none'} /><Kv k="Do-not-contact" v={d.consent.dnc ? <Chip tone="danger">yes · {d.consent.dnc_reason}</Chip> : 'no'} /></dl><SourceStamp resource="contacts · consents" /></Panel>
          <Panel icon={<FileText size={16} />} title="Identity documents"><dl className="grid grid-cols-2 gap-3"><Kv k="QID" v={<>{maskQid(d.identity.qidNumber)} · expires {date(d.identity.qidExpiry)}{q.checks.find((x: any) => x.code === 'R07')?.pass ? <Chip tone="success" className="ms-1">valid</Chip> : <Chip tone="danger" className="ms-1">expired</Chip>}</>} />{!c.is_qatari ? <Kv k="Passport" v={<>{d.identity.passportNumber ?? '—'} · expires {date(d.identity.passportExpiry)}{q.checks.find((x: any) => x.code === 'R06')?.pass ? <Chip tone="success" className="ms-1">valid</Chip> : <Chip tone="danger" className="ms-1">expired</Chip>}</>} /> : null}<Kv k="Date of birth" v={`${date(c.dob)}`} /><Kv k="Segment tag" v={c.segment_tag ?? '—'} /></dl>{d.notes.length ? <div className="mt-2 space-y-1">{d.notes.map((n: any) => <p key={n.id} className="text-[12px]"><Chip tone={n.lifted_on ? undefined : 'danger'}>{n.type}</Chip> set {date(n.set_on)} by {n.set_by} · lifts when: {n.lifting_condition}{n.lifted_on ? ` · lifted ${date(n.lifted_on)}` : ''}</p>)}</div> : null}<SourceStamp resource="identity_documents · cautionary_notes" /></Panel>
        </>}>
          <Panel icon={<Building2 size={16} />} title="Employment and salary" action={d.employer ? <PanelAction onClick={() => go('employers', d.employer.id)}>Employer</PanelAction> : undefined}>
            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4"><Kv k="Employer" v={d.employment.employerName ? <>{d.employment.employerName} <Chip tone={d.employment.employerStatus === 'APPROVED' ? 'success' : 'warn'}>{title(d.employment.employerStatus)}</Chip></> : <Chip tone="warn">none on record</Chip>} /><Kv k="Salary total" v={qar(d.employment.total)} /><Kv k="Basic / allowances / social" v={`${qar(d.employment.basic)} / ${qar(d.employment.allowances)} / ${qar(d.employment.social)}`} /><Kv k="Salary paid to" v={d.employment.salaryBank} /></dl>
            <p className="eyebrow mt-4">Salary credits, last 12 months</p>
            <div className="mt-1 flex items-end gap-1" style={{ height: 70 }}>{d.credits.map((cr: any) => { const h = Math.max(4, (100 * cr.amount) / Math.max(1, d.employment.total)); return <div key={cr.month} className="flex flex-1 flex-col items-center gap-1" title={`${month(cr.month)}: ${qar(cr.amount)}${cr.explained_reason ? ` · explained: ${cr.explained_reason}` : ''}`}><div className={`w-full rounded-t ${cr.amount === 0 ? 'bg-danger/60' : cr.explained_reason ? 'bg-warn' : cr.amount < 0.7 * d.employment.total ? 'bg-warn' : 'bg-primary'}`} style={{ height: `${Math.min(100, h)}%` }} /><span className="font-mono text-[9px] text-muted-foreground">{month(cr.month).slice(0, 3)}</span></div>; })}</div>
            {q.inputs.salaryMissing.length || q.inputs.salaryLow.length ? <p className="mt-1 text-[12px] text-danger">Missing: {q.inputs.salaryMissing.join(', ') || 'none'} · Low: {q.inputs.salaryLow.join(', ') || 'none'}</p> : null}
            <SourceStamp resource="employment · salary_credits" />
          </Panel>
          <div className="grid gap-4 md:grid-cols-2">
            <Panel icon={<Landmark size={16} />} title="Accounts and deposits"><ul className="space-y-1 text-[13px]">{d.accounts.map((a: any) => <li key={a.id} className="flex items-center gap-2"><Chip>{a.type}</Chip><span className="font-mono text-[12px]">{a.iban}</span><StatusChip status={a.status} /><span className="ms-auto font-mono">{qar(a.balance)}</span></li>)}</ul><p className="mt-2 text-[12px] text-muted-foreground">Deposits {qar(c.deposits)}</p><SourceStamp resource="accounts" /></Panel>
            <Panel icon={<CreditCard size={16} />} title="Facilities, cards, standing orders, cheques">
              {d.facilities.map((f: any) => <p key={f.id} className="text-[13px]"><Chip>{title(f.product)}</Chip> outstanding {qar(f.outstanding)} · repayable {qar(f.repayable)} · instalment {qar(f.instalment)} · matures {date(f.maturity)}{f.dpd ? <Chip tone="danger" className="ms-1">DPD {f.dpd}</Chip> : null}{f.late_payments_6m ? <Chip tone="warn" className="ms-1">{f.late_payments_6m} late / 6m</Chip> : null}{f.schedule_irregular ? <Chip tone="warn" className="ms-1">restructured</Chip> : null}</p>)}
              {d.cards.map((k: any) => <p key={k.id} className="text-[13px]"><Chip>Card</Chip> limit {qar(k.card_limit)} · outstanding {qar(k.outstanding)}{k.dpd ? <Chip tone="danger" className="ms-1">DPD {k.dpd}</Chip> : null}</p>)}
              {d.standingOrders.map((s: any) => <p key={s.id} className="text-[13px]"><Chip>SO</Chip> {s.beneficiary_name} · {qar(s.amount)}/month · bank type {s.beneficiary_type}{s.customer_classification ? <Chip tone="success" className="ms-1">declared {s.customer_classification}</Chip> : null}</p>)}
              {d.cheques.map((ch: any) => <p key={ch.id} className="text-[13px]"><Chip tone="danger">Returned cheque</Chip> {date(ch.returned_on)} · {qar(ch.amount)} · {ch.settled_on ? `settled ${date(ch.settled_on)}` : 'unsettled'}</p>)}
              {!d.facilities.length && !d.cards.length && !d.standingOrders.length && !d.cheques.length ? <p className="text-[12px] text-muted-foreground">No facilities, cards, standing orders or cheques.</p> : null}
              <SourceStamp resource="finance_facilities · cards · standing_orders · cheques_returned" />
            </Panel>
          </div>
          <Panel icon={<ShieldCheck size={16} />} title="Scores the bank's model provides (opaque inputs)"><dl className="grid grid-cols-3 gap-3"><Kv k="Model score" v={<span className="font-mono">{Number(c.model_score).toFixed(2)}</span>} /><Kv k="Internal rating" v={c.internal_rating} /><Kv k="Auto Ijara score" v={<span className="font-mono">{Number(c.auto_ijara_score).toFixed(2)}</span>} /></dl></Panel>
        </PageColumns>
      ) : null}
      {tab === 'rules' ? (
        <Panel icon={<ShieldCheck size={16} />} title="The twenty rules, under the active policy" action={<PanelAction onClick={() => go('policies', 'POL-04')}>POL-04</PanelAction>}>
          <Table><thead><tr><th>Rule</th><th>Result</th><th>Detail</th></tr></thead><tbody>{q.checks.map((x: any) => <tr key={x.code}><td className="font-mono text-[12px]">{x.code}</td><td>{x.pass ? <Chip tone="success">pass</Chip> : <Chip tone="danger">fail</Chip>}</td><td className="text-[13px]">{x.detail}</td></tr>)}</tbody></Table>
          <p className="mt-2 text-[11px] text-muted-foreground">amount = min(capacity × annuity factor, headroom × annuity factor ÷ tenor), rounded to 500; capacity = DBR base × DBR% − obligations; R20 affects vehicle finance only.</p>
          <WhatIf id={c.id} />
        </Panel>
      ) : null}
      {tab === 'cases' ? <Panel icon={<Wallet size={16} />} title="Cases"><Table><thead><tr><th>Case</th><th>Class</th><th>State</th><th>Reasons</th><th>Opened</th><th>Closed</th></tr></thead><tbody>{d.cases.map((k: any) => <tr key={k.id} className="clickable" onClick={() => openCase(k.ref)}><td><Ref>{k.ref}</Ref></td><td><ClassChip cls={k.cls} /></td><td><StatusChip status={k.state} /> {k.close_code ? <StatusChip status={k.close_code} /> : null}</td><td><span className="flex flex-wrap gap-1">{k.reasons.map((r: string) => <ReasonChip key={r} code={r} />)}</span></td><td className="text-[12px]">{date(k.opened_at)}</td><td className="text-[12px]">{k.closed_at ? date(k.closed_at) : '—'}</td></tr>)}</tbody></Table>{!d.cases.length ? <Empty>No cases: eligible at every scan.</Empty> : null}</Panel> : null}
      {tab === 'comms' ? <Panel icon={<Smartphone size={16} />} title="Messages out" action={<PanelAction onClick={() => go('comms', `customer=${c.id}`)}>All communications</PanelAction>}><Messages rows={d.messages} />{d.inbound.length ? <><p className="eyebrow mt-4">Inbound</p><ul className="mt-1 space-y-1 text-[12px]">{d.inbound.map((i: any) => <li key={i.id}><span className="font-mono text-muted-foreground">{dateTime(i.received_at)} · {i.channel}</span> <StatusChip status={i.classification} /> {i.body}</li>)}</ul></> : null}</Panel> : null}
      {tab === 'docs' ? <Panel icon={<FileText size={16} />} title="Documents and proposed updates"><ul className="space-y-1 text-[12px]">{d.documents.map((doc: any) => <li key={doc.id} className="flex flex-wrap items-center gap-2"><button type="button" className="font-mono text-primary" onClick={() => open(`document:${doc.id}`)}>document {doc.id}</button><Chip>{doc.type}</Chip><StatusChip status={doc.state} />{doc.recommendation ? <Chip tone={doc.recommendation === 'APPROVE' ? 'success' : 'danger'}>{doc.recommendation.toLowerCase()}</Chip> : null}<span className="text-muted-foreground">{dateTime(doc.received_at)}</span></li>)}</ul>{!d.documents.length ? <Empty>No documents received.</Empty> : null}<div className="mt-2"><Proposals rows={d.proposals} /></div></Panel> : null}
      {tab === 'trail' ? <Panel icon={<ShieldCheck size={16} />} title="Trail"><TrailList rows={d.trail} /></Panel> : null}
      {persona?.key === 'rm' && openK ? <p className="text-[11px] text-muted-foreground">RM: {PERSONA_SHORT.rm} owns every contact for this client.</p> : null}
      <DecideHere customerId={c.id} />
    </Screen>
  );
}

function WhatIf({ id }: { id: string }) {
  const [salary, setSalary] = useState(''); const [dropSo, setDropSo] = useState(false); const [clearDpd, setClearDpd] = useState(false); const [emp, setEmp] = useState(false); const [qid, setQid] = useState(false);
  const qs = new URLSearchParams({ salary, dropSo: dropSo ? '1' : '', clearDpd: clearDpd ? '1' : '', employer: emp ? '1' : '', qid: qid ? '1' : '' }).toString();
  const active = salary || dropSo || clearDpd || emp || qid;
  const { data } = useApi<any>(active ? `/customers/${id}/whatif?${qs}` : null);
  return (
    <div className="mt-4 rounded-xl border border-border/60 bg-card/40 p-3">
      <p className="eyebrow">What if…</p>
      <div className="mt-2 flex flex-wrap items-center gap-3 text-[12px]"><input className="input h-8 w-36" placeholder="salary QAR" value={salary} onChange={(e) => setSalary(e.target.value.replace(/\D/g, ''))} /><label className="flex items-center gap-1"><input type="checkbox" checked={qid} onChange={(e) => setQid(e.target.checked)} />documents renewed</label><label className="flex items-center gap-1"><input type="checkbox" checked={emp} onChange={(e) => setEmp(e.target.checked)} />employer approved</label><label className="flex items-center gap-1"><input type="checkbox" checked={dropSo} onChange={(e) => setDropSo(e.target.checked)} />standing orders reclassified</label><label className="flex items-center gap-1"><input type="checkbox" checked={clearDpd} onChange={(e) => setClearDpd(e.target.checked)} />arrears paid</label></div>
      {data?.whatIf ? <p className="mt-2 text-sm">{data.whatIf.eligible ? <><Chip tone="success">eligible</Chip> {qar(data.whatIf.amount)} over {data.whatIf.inputs.tenor} months</> : <><Chip tone="danger">still not eligible</Chip> {data.whatIf.reasons.join(', ')}</>}</p> : null}
    </div>
  );
}

/** If a run on this customer's open case waits on the signed-in persona, decide it here too. */
function DecideHere({ customerId }: { customerId: string }) {
  const { persona } = useApp();
  const { data, reload } = useApi<any>(`/cases?q=${customerId}&open=1`);
  const k = data?.rows?.[0];
  const { data: detail } = useApi<any>(k ? `/cases/${k.ref}` : null);
  const run = detail?.runs?.find((r: any) => (r.status === 'WAITING' || r.status === 'ESCALATED') && r.waiting_on_persona === persona?.key);
  if (!run) return null;
  return <Panel title={`Decision on ${k.ref}`}><Recommendation run={run} /><div className="mt-2"><Decide run={run} onDone={() => { bump(); reload(); }} /></div></Panel>;
}

export function EmployersScreen() {
  const { route, go } = useApp();
  const id = route.param && !route.param.includes('=') ? route.param : null;
  if (id) return <EmployerDetail id={id} />;
  return <EmployerList />;
}
function EmployerList() {
  const { go } = useApp();
  const [q, setQ] = useState(''); const [status, setStatus] = useState('');
  const { data } = useApi<any[]>(`/employers?q=${encodeURIComponent(q)}&status=${status}`);
  const rows = data ?? [];
  const totals = useMemo(() => ({ approved: rows.filter((e) => e.approval_status === 'APPROVED').length, blocked: rows.reduce((s, e) => s + e.blocked, 0) }), [rows]);
  return (
    <Screen hero={<Hero eyebrow="Employers · the approved list" title={<>{num(rows.length)} employers on the register</>} lede="Salary-transfer finance needs an approved employer. One Credit Policy approval re-qualifies every customer of that employer at once — the leverage this screen shows. Criteria are POL-03 §5.1 parameters." />}>
      <StatRow><StatTile label="Approved" value={num(totals.approved)} /><StatTile label="Customers blocked by an employer" value={num(totals.blocked)} /><StatTile label="Under review" value={num(rows.filter((e) => e.approval_status === 'UNDER_REVIEW').length)} /><StatTile label="Unapproved with staff" value={num(rows.filter((e) => e.approval_status === 'UNAPPROVED' && e.staff > 0).length)} /></StatRow>
      <div className="flex flex-wrap gap-2"><input className="input" placeholder="Search employers" value={q} onChange={(e) => setQ(e.target.value)} /><Select value={status} onChange={setStatus}><option value="">All statuses</option><option value="APPROVED">Approved</option><option value="UNAPPROVED">Unapproved</option><option value="UNDER_REVIEW">Under review</option><option value="RESTRICTED">Restricted</option></Select></div>
      <Panel icon={<Building2 size={16} />} title="Register"><Table><thead><tr><th>Employer</th><th>Sector</th><th>Headcount</th><th>Status</th><th>QIB-salaried</th><th>Blocked customers</th><th>Review</th></tr></thead><tbody>{rows.map((e) => <tr key={e.id} className="clickable" onClick={() => go('employers', e.id)}><td><span className="block text-sm font-medium">{e.name_en}</span><span className="font-mono text-[11px] text-muted-foreground">{e.id}</span></td><td className="text-[12px]">{title(e.sector)}</td><td className="font-mono text-[12px]">{num(e.headcount)}</td><td><StatusChip status={e.approval_status === 'UNDER_REVIEW' ? 'UNDER_REVIEW_E' : e.approval_status} /></td><td className="font-mono">{e.staff}</td><td className="font-mono">{e.blocked ? <Chip tone="warn">{e.blocked}</Chip> : '—'}</td><td className="text-[12px]">{e.review_state ? <StatusChip status={e.review_state} /> : '—'}</td></tr>)}</tbody></Table></Panel>
    </Screen>
  );
}
function EmployerDetail({ id }: { id: string }) {
  const { go, openCase, persona } = useApp();
  const { data: d, error, reload } = useApi<any>(`/employers/${id}`);
  const [msg, setMsg] = useState('');
  const { data: run } = useApi<any>(d?.run?.id ? `/runs/${d.run.id}` : null);
  if (error) return <Empty>{error}</Empty>;
  if (!d) return <p className="p-6 text-sm text-muted-foreground">Loading…</p>;
  const e = d.employer; const rv = d.reviews[0]; const pack = rv?.pack;
  const mine = run && (run.status === 'WAITING' || run.status === 'ESCALATED') && run.waiting_on_persona === persona?.key;
  return (
    <Screen hero={<Hero eyebrow={<span className="flex items-center gap-2">Employer <Ref>{e.id}</Ref></span>} title={<>{e.name_en} <span className="ar text-muted-foreground">{e.name_ar}</span></>} lede={<span className="flex flex-wrap items-center gap-2"><StatusChip status={e.approval_status === 'UNDER_REVIEW' ? 'UNDER_REVIEW_E' : e.approval_status} /><span>{title(e.sector)} · {num(e.headcount)} staff ({e.headcount_band}) · {e.months_operating} months operating · CR {e.cr_number ?? 'none'} to {date(e.cr_valid_to)} · WPS {e.wps_active ? 'active' : 'inactive'}</span></span>}
      actions={<div className="flex gap-2"><Btn onClick={() => go('employers')}>All employers</Btn>{d.can.open && e.approval_status !== 'APPROVED' && !d.run ? <Btn kind="primary" onClick={async () => { try { const r = await post(`/employers/${e.id}/review`); setMsg(r.note); bump(); reload(); } catch (x: any) { setMsg(x.message); } }}>Open an employer review</Btn> : null}</div>}
      feature={<div className="rounded-2xl border border-border/60 bg-card/60 p-4"><p className="eyebrow">Leverage</p><p className="mt-1 text-2xl font-extrabold tabular-nums">{d.staff.filter((s: any) => s.eligible === false && (s.reason_codes ?? []).includes('R02')).length} <span className="text-base font-medium text-muted-foreground">customers blocked by this employer</span></p><p className="text-[12px] text-muted-foreground">{d.staff.length} QIB-salaried customers in all</p></div>} />}>
      {msg ? <Note>{msg}</Note> : null}
      {pack ? (
        <Panel icon={<ShieldCheck size={16} />} title={`Approval pack · Muwathiq recommends: ${pack.recommendation}`} action={<StatusChip status={pack.mode} />}>
          <Table><thead><tr><th>Criterion (POL-03 §5.1)</th><th>Value</th><th>Required</th><th>Result</th></tr></thead><tbody>{pack.criteria.map((c: any) => <tr key={c.key}><td>{c.label}</td><td className="font-mono text-[12px]">{c.value}</td><td className="text-[12px] text-muted-foreground">{c.required}</td><td>{c.ok ? <Chip tone="success">met</Chip> : <Chip tone="danger">not met</Chip>}</td></tr>)}</tbody></Table>
          <p className="mt-2 text-sm leading-relaxed">{pack.narrative}</p>
          <p className="mt-1 text-[11px] text-muted-foreground">Review {rv.state.toLowerCase()} · opened {dateTime(rv.opened_at)}{rv.decided_by ? ` · decided by ${PERSONA_SHORT[rv.decided_by] ?? rv.decided_by} ${dateTime(rv.decided_at)}: ${rv.reason ?? ''}` : ''}</p>
          {mine ? <div className="mt-3"><Recommendation run={run} /><div className="mt-2"><Decide run={run} onDone={() => { bump(); reload(); }} /></div></div> : d.run?.status === 'WAITING' ? <p className="mt-2 text-[12px] text-muted-foreground">Waiting on {PERSONA_SHORT[d.run.waiting_on_persona]}.</p> : null}
        </Panel>
      ) : null}
      <Panel icon={<UserRound size={16} />} title={`${d.staff.length} QIB-salaried customers`}><Table><thead><tr><th>Customer</th><th>Segment</th><th>Salary</th><th>Eligible</th><th>Reasons</th><th>Case</th></tr></thead><tbody>{d.staff.map((s: any) => <tr key={s.id} className="clickable" onClick={() => go('customers', s.id)}><td><span className="block text-sm">{s.name_en}</span><span className="font-mono text-[11px] text-muted-foreground">{s.id}</span></td><td><SegChip s={s.segment} /></td><td className="font-mono text-[12px]">{qar(s.salary_total)}</td><td>{s.eligible ? <Chip tone="success">yes</Chip> : <Chip tone="danger">no</Chip>}</td><td><span className="flex flex-wrap gap-1">{(s.reason_codes ?? []).map((r: string) => <ReasonChip key={r} code={r} />)}</span></td><td className="text-[12px]">{s.case_ref ? <button type="button" className="font-mono text-primary" onClick={(ev) => { ev.stopPropagation(); openCase(s.case_ref); }}>{s.case_ref}</button> : '—'}</td></tr>)}</tbody></Table></Panel>
      <Panel icon={<ShieldCheck size={16} />} title="Trail"><TrailList rows={d.trail} compact /></Panel>
    </Screen>
  );
}
