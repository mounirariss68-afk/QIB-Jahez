/**
 * Customers — "Which customer is not pre-approved, and why?" — the record
 * ("why is this customer not pre-approved, and what would change it?") and
 * the employer register ("which approval frees the most customers?"). Each
 * screen a heading with its claim; the twenty rules, the DBR and the cap, the
 * salary months and the employers drawn, not tabled; ids in the hover.
 */
import { useEffect, useState } from 'react';
import { Panel, PanelAction, PageColumns } from '@cognirise/cognipulse/layout';
import { FigureTile, Segments } from '@cognirise/cognipulse/viz';
import { Building2, CreditCard, FileText, Landmark, Search, ShieldCheck, Smartphone, UserRound, Wallet } from 'lucide-react';
import { bump, post, useApi } from '../lib/api';
import { date, dateTime, maskQid, num, qar, title } from '../lib/format';
import { useApp, useFlash } from '../app/state';
import { monthName, gapReason } from '../app/plain';
import { TrailList, Messages, Proposals, Decide, Recommendation } from '../app/case';
import { Btn, Chip, Empty, Hero, Kv, Note, Screen, SourceStamp, StatusChip, Table, Tabs, Select, CLASS_LABEL, DOC_LABEL, NOTE_LABEL, PERSONA_SHORT, REASON_LABEL, SEG } from '../app/ui';
import { Headroom, RuleDots, SalaryColumns } from '../app/viz';

const parseParam = (p: string | null) => { const o: Record<string, string> = {}; if (!p) return o; if (!p.includes('=')) return { id: p }; for (const kv of p.split('&')) { const [k, v] = kv.split('='); o[k] = decodeURIComponent(v ?? ''); } return o; };
/** The twenty rules from the reason codes a scan stored: every rule passes except the ones named. */
const RULES = Object.keys(REASON_LABEL).sort();
const checksOf = (codes: string[] | null | undefined) => RULES.map((code) => ({ code, pass: !(codes ?? []).includes(code) }));
const lc = (s: string) => String(s ?? '').replace(/^[A-Z](?=[a-z])/, (c) => c.toLowerCase());

export function CustomersScreen() {
  const { route } = useApp();
  const p = parseParam(route.param);
  if (p.id) return <Customer360 id={p.id} />;
  return <CustomerList init={p} />;
}

/** Where a customer stands, as one filter: eligible, or what stands in the way. */
const STANDING: [string, string][] = [['', 'Eligible and not'], ['yes', 'Eligible tonight'], ...Object.entries(CLASS_LABEL).map(([c, l]) => [c, l] as [string, string])];

function CustomerList({ init }: { init: Record<string, string> }) {
  const { go, persona } = useApp();
  const [q, setQ] = useState(init.q ?? ''); const [segment, setSegment] = useState(init.segment ?? ''); const [reason, setReason] = useState(init.reason ?? ''); const [standing, setStanding] = useState(init.cls ?? init.eligible ?? ''); const [page, setPage] = useState(0);
  useEffect(() => { setSegment(init.segment ?? ''); setReason(init.reason ?? ''); setStanding(init.cls ?? init.eligible ?? ''); setQ(init.q ?? ''); setPage(0); }, [init.segment, init.reason, init.cls, init.eligible, init.q]);
  const cls = /^[A-D]$/.test(standing) ? standing : ''; const eligible = standing === 'yes' || standing === 'no' ? standing : '';
  const qs = new URLSearchParams({ q, segment, reason, cls, eligible, page: String(page), size: '40' }).toString();
  const { data, error } = useApi<any>(`/customers?${qs}`);
  const { data: reasons } = useApi<any>('/reasons');
  if (persona?.scope?.metricsOnly) return <Screen hero={<Hero eyebrow="Customers" title="The Data Steward sees metrics, not customers" lede="Field-level metrics and definitions are on Data health; customer records are not in this persona's scope." />}><Empty>Drill-downs show DEMO ids only, never a record.</Empty></Screen>;
  const total = data?.total ?? 0;
  const claim = !data ? 'Customers' : reason ? `${num(total)} customers fail on ${lc(REASON_LABEL[reason] ?? reason)}` : standing === 'yes' ? `${num(total)} customers can be pre-approved tonight` : cls ? `${num(total)} customers: ${lc(CLASS_LABEL[cls])}` : `${num(total)} customers${segment ? ` in ${SEG[segment] ?? segment}` : ''}`;
  return (
    <Screen hero={<Hero eyebrow="Customers · the synthetic base" title={claim} lede="Each row is the last scan under the active policy: the twenty rules, a failing rule red and named under the strip. Open a customer for what would change it." />}>
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative"><Search className="pointer-events-none absolute start-3 top-2.5 h-4 w-4 text-muted-foreground" /><input className="input" style={{ paddingInlineStart: '2.25rem' }} placeholder="Name or employer" value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} /></div>
        <Select value={standing} onChange={(v) => { setStanding(v); setPage(0); }}>{STANDING.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</Select>
        <Select value={reason} onChange={(v) => { setReason(v); setPage(0); }}><option value="">Every reason</option>{(reasons?.reasons ?? []).map((r: any) => <option key={r.code} value={r.code}>{r.label}</option>)}</Select>
        <Select value={segment} onChange={(v) => { setSegment(v); setPage(0); }}><option value="">Every segment</option><option value="VVIP">VVIP</option><option value="HNWI">HNWI</option><option value="HIGH_VALUE">High Value</option><option value="MASS">Mass</option></Select>
      </div>
      {error ? <Empty>{error}</Empty> : null}
      <Panel icon={<UserRound size={16} />} title={`${num(total)} match`} action={<span className="text-[12px] text-muted-foreground">page {page + 1} of {Math.max(1, Math.ceil(total / 40))}</span>}>
        <Table>
          <thead><tr><th>Customer</th><th>Employer</th><th>Salary</th><th>One Click tonight</th><th style={{ width: 260 }}>The twenty rules</th><th>Case</th></tr></thead>
          <tbody>{(data?.rows ?? []).map((r: any) => <CustomerRow key={r.id} r={r} onOpen={() => go('customers', r.id)} />)}</tbody>
        </Table>
        <div className="mt-3 flex items-center gap-2"><Btn small onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0}>Previous</Btn><Btn small onClick={() => setPage((p) => p + 1)} disabled={(page + 1) * 40 >= total}>Next</Btn></div>
      </Panel>
    </Screen>
  );
}
function CustomerRow({ r, onOpen }: { r: any; onOpen: () => void }) {
  const flash = useFlash('customers', r.id, true);
  const codes = (r.reason_codes ?? []).filter((c: string) => c !== 'R20');
  return (
    <tr className={`clickable ${flash}`} onClick={onOpen} title={`${r.id}${r.case_ref ? ` · ${r.case_ref}` : ''}`}>
      <td><span className="block text-sm font-medium">{r.name_en}</span><span className="block text-[11px] text-muted-foreground">{SEG[r.segment] ?? r.segment} · {r.is_qatari ? 'Qatari' : 'resident'}{r.status !== 'NORMAL' ? ` · ${lc(title(r.status))}` : ''}</span></td>
      <td className="text-[12px]">{r.employer ?? <span className="text-muted-foreground">none on record</span>}{r.employer_status && r.employer_status !== 'APPROVED' ? <span className="block text-[11px] text-warn">{lc(title(r.employer_status))}</span> : null}</td>
      <td className="font-mono text-[12px]">{qar(r.salary_total)}</td>
      <td className="text-[12px]">{r.eligible ? <span className="font-medium text-success">{qar(r.amount)}</span> : <span className="text-muted-foreground">{CLASS_LABEL[r.cls] ?? 'not eligible'}</span>}</td>
      <td><RuleDots checks={checksOf(codes)} /></td>
      <td className="text-[12px]">{r.case_ref ? <StatusChip status={r.case_state} /> : <span className="text-muted-foreground">—</span>}</td>
    </tr>
  );
}

export function Customer360({ id }: { id: string }) {
  const { go, open, openCase, persona, session } = useApp();
  const { data: d, error, reload } = useApi<any>(`/customers/${id}`);
  const [tab, setTab] = useState('record');
  const [msg, setMsg] = useState('');
  const flash = useFlash('customers', id);
  if (error) return <Screen hero={<Hero eyebrow="Customer" title="This customer is not in your scope" lede={error} />}><Empty>{error}</Empty></Screen>;
  if (!d) return <p className="p-6 text-sm text-muted-foreground">Loading…</p>;
  const c = d.customer, q = d.qualification, x = q.inputs;
  const openK = d.cases.find((k: any) => k.state !== 'CLOSED');
  const failed = q.checks.filter((k: any) => !k.pass && k.code !== 'R20');
  const dbrLimit = Math.round((x.dbrBase * x.dbrPct) / 100);
  const now: string = session?.clock.now ?? new Date().toISOString();
  const claim = q.eligible ? `${c.nameEn} can be pre-approved for ${qar(q.amount)} tonight` : `${c.nameEn} is not pre-approved: ${failed.map((k: any) => lc(REASON_LABEL[k.code] ?? k.code)).join(', ') || 'see the rules'}`;
  const explained = (d.credits as any[]).filter((cr) => cr.explained_reason);
  return (
    <Screen hero={<Hero
      eyebrow={<span title={`${c.id} · RIM ${c.rim_no} · synthetic record`}><span className={flash}>{c.nameEn}</span> <span className="ar">{c.nameAr}</span> · {SEG[c.segment] ?? c.segment} · {c.is_qatari ? 'Qatari national' : `resident, ${c.nationality}`}{d.rm ? ` · RM ${d.rm.name_en}` : ''} · customer since {date(c.joined_on)}{c.status !== 'NORMAL' ? ` · ${lc(title(c.status))}` : ''}</span>}
      title={claim}
      lede={c.card_restricted ? 'The cards are temporarily restricted while the expired document is renewed.' : undefined}
      actions={<>{openK ? <Btn kind="primary" onClick={() => openCase(openK.ref)} title={openK.ref}>Open the case</Btn> : null}<Btn onClick={() => go('customer-app', c.id)}>The customer's phone</Btn><Btn onClick={() => go('comms', `mailbox=${c.id}`)}>Mailbox</Btn>{d.can.rerun ? <Btn onClick={async () => { try { const r = await post(`/customers/${c.id}/requalify`); setMsg(r.eligible ? `Eligible: ${qar(r.amount)}; the hand-off started` : `Still not eligible: ${r.reasons.map((k: string) => REASON_LABEL[k] ?? k).join(', ')}`); bump(); reload(); } catch (e: any) { setMsg(e.message); } }}>Re-run the check</Btn> : null}</>} />}>
      {msg ? <Note>{msg}</Note> : null}
      <div className="grid gap-3 md:grid-cols-3">
        <FigureTile label="The twenty rules" value={q.eligible ? `All pass · ${qar(q.amount)} over ${x.tenor} months` : `${q.checks.length - failed.length} of ${q.checks.length} pass`} sub={q.eligible ? (q.eligibleVehicle ? undefined : 'vehicle finance excluded') : CLASS_LABEL[q.cls]}>
          <RuleDots checks={q.checks} />
        </FigureTile>
        <FigureTile label={`Monthly obligations against ${x.dbrPct}% of the salary base`} value={`${qar(x.obligations)} of ${qar(dbrLimit)}`} sub={x.capacity > 0 ? `${qar(x.capacity)} a month left for a new instalment` : 'no room for a new instalment'}>
          <Headroom value={x.obligations} cap={dbrLimit} />
        </FigureTile>
        <FigureTile label="Exposure against the cap" value={`${qar(x.exposure)} of ${qar(x.cap)}`} sub={x.headroom > 0 ? `${qar(x.headroom)} headroom` : 'over the cap'}>
          <Headroom value={x.exposure} cap={x.cap} />
        </FigureTile>
      </div>
      <Tabs value={tab} onChange={setTab} tabs={[{ id: 'record', label: 'Record' }, { id: 'rules', label: 'The twenty rules' }, { id: 'cases', label: 'Cases' }, { id: 'comms', label: 'Messages' }, { id: 'docs', label: 'Documents' }, { id: 'trail', label: 'Trail' }]} />
      {tab === 'record' ? (
        <PageColumns aside={<>
          <Panel icon={<Smartphone size={16} />} title="Contact and consent"><dl className="grid grid-cols-2 gap-3"><Kv k="Mobile" v={d.contact?.mobile} mono /><Kv k="E-mail" v={d.contact?.email} /><Kv k="App" v={d.contact?.app_registered ? `registered · push ${d.contact.push_enabled ? 'on' : 'off'} · last login ${date(d.contact.last_app_login)}` : 'not registered'} /><Kv k="Language" v={c.language_pref === 'ar' ? 'Arabic' : 'English'} /><Kv k="Marketing consent" v={d.consent.marketing_consent ? 'yes' : <span className="text-warn">no: offers are blocked</span>} /><Kv k="Channel opt-outs" v={d.consent.channel_optouts?.length ? d.consent.channel_optouts.join(', ').toLowerCase() : 'none'} /><Kv k="Do-not-contact" v={d.consent.dnc ? <span className="text-danger">yes · {d.consent.dnc_reason}</span> : 'no'} /></dl><SourceStamp resource="contacts · consents" /></Panel>
          <Panel icon={<FileText size={16} />} title="Identity documents"><dl className="grid grid-cols-2 gap-3"><Kv k="QID" v={<>{maskQid(d.identity.qidNumber)} · expires {date(d.identity.qidExpiry)}{q.checks.find((k: any) => k.code === 'R07')?.pass ? null : <span className="ms-1 text-danger">expired</span>}</>} />{!c.is_qatari ? <Kv k="Passport" v={<>expires {date(d.identity.passportExpiry)}{q.checks.find((k: any) => k.code === 'R06')?.pass ? null : <span className="ms-1 text-danger">expired</span>}</>} /> : null}<Kv k="Date of birth" v={date(c.dob)} /></dl>{d.notes.length ? <div className="mt-2 space-y-1">{d.notes.map((n: any) => <p key={n.id} className="text-[12px]"><span className={n.lifted_on ? '' : 'font-medium text-danger'}>{NOTE_LABEL[n.type] ?? lc(title(n.type))} note</span> set {date(n.set_on)} by {n.set_by} · lifts when {lc(n.lifting_condition)}{n.lifted_on ? ` · lifted ${date(n.lifted_on)}` : ''}</p>)}</div> : null}<SourceStamp resource="identity_documents · cautionary_notes" /></Panel>
        </>}>
          <Panel icon={<Building2 size={16} />} title={d.employment.employerName ? `Salary from ${d.employment.employerName}${d.employment.employerStatus !== 'APPROVED' ? `, ${lc(title(d.employment.employerStatus))}` : ''}` : 'No employer on record'} action={d.employer ? <PanelAction onClick={() => go('employers', d.employer.id)}>The employer</PanelAction> : undefined}>
            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4"><Kv k="Salary in all" v={qar(d.employment.total)} /><Kv k="Basic" v={qar(d.employment.basic)} /><Kv k="Allowances and social" v={qar(Number(d.employment.allowances ?? 0) + Number(d.employment.social ?? 0))} /><Kv k="Paid to" v={d.employment.salaryBank} /></dl>
            <p className="mt-4 text-[12px] text-muted-foreground">Salary credits, the last twelve months</p>
            <div className="mt-1"><SalaryColumns credits={d.credits} now={now} /></div>
            {explained.length ? <p className="mt-1 text-[12px] text-muted-foreground">{explained.map((cr) => `${monthName(String(cr.month).slice(0, 7))} explained: ${gapReason(cr.explained_reason)}`).join(' · ')}</p> : null}
            <SourceStamp resource="employment · salary_credits" />
          </Panel>
          <div className="grid gap-4 md:grid-cols-2">
            <Panel icon={<Landmark size={16} />} title={`Deposits ${qar(c.deposits)}`}><ul className="space-y-1 text-[13px]">{d.accounts.map((a: any) => <li key={a.id} className="flex items-center gap-2" title={a.iban}><span>{lc(title(a.type))} account</span><StatusChip status={a.status} /><span className="ms-auto font-mono">{qar(a.balance)}</span></li>)}</ul><SourceStamp resource="accounts" /></Panel>
            <Panel icon={<CreditCard size={16} />} title="Finance, cards, standing orders, cheques">
              {d.facilities.map((f: any) => <p key={f.id} className="text-[13px]">{title(f.product)}: {qar(f.instalment)} a month, {qar(f.outstanding)} outstanding to {date(f.maturity)}{f.dpd ? <span className="ms-1 text-danger">{f.dpd} days past due</span> : null}{f.late_payments_6m ? <span className="ms-1 text-warn">{f.late_payments_6m} late in six months</span> : null}{f.schedule_irregular ? <span className="ms-1 text-warn">restructured</span> : null}</p>)}
              {d.cards.map((k: any) => <p key={k.id} className="text-[13px]">Card: {qar(k.outstanding)} of {qar(k.card_limit)}{k.dpd ? <span className="ms-1 text-danger">{k.dpd} days past due</span> : null}</p>)}
              {d.standingOrders.map((s: any) => <p key={s.id} className="text-[13px]">Standing order to {s.beneficiary_name}: {qar(s.amount)} a month{s.customer_classification ? <span className="ms-1 text-success">declared {lc(String(s.customer_classification))}</span> : null}</p>)}
              {d.cheques.map((ch: any) => <p key={ch.id} className="text-[13px] text-danger">Returned cheque {date(ch.returned_on)}, {qar(ch.amount)}, {ch.settled_on ? `settled ${date(ch.settled_on)}` : 'unsettled'}</p>)}
              {!d.facilities.length && !d.cards.length && !d.standingOrders.length && !d.cheques.length ? <p className="text-[12px] text-muted-foreground">No finance, cards, standing orders or cheques.</p> : null}
              <SourceStamp resource="finance_facilities · cards · standing_orders · cheques_returned" />
            </Panel>
          </div>
          <Panel icon={<ShieldCheck size={16} />} title="Scores the bank's model provides (read, never computed here)"><dl className="grid grid-cols-3 gap-3"><Kv k="Model score" v={<span className="font-mono">{Number(c.model_score).toFixed(2)}</span>} /><Kv k="Internal rating" v={c.internal_rating} /><Kv k="Auto Ijara score" v={<span className="font-mono">{Number(c.auto_ijara_score).toFixed(2)}</span>} /></dl></Panel>
        </PageColumns>
      ) : null}
      {tab === 'rules' ? (
        <Panel icon={<ShieldCheck size={16} />} title={failed.length ? `${failed.length === 1 ? 'One rule fails' : `${failed.length} rules fail`}; the what-if says what would change it` : 'Every rule passes'} action={<PanelAction onClick={() => go('policies', 'POL-04')}>The eligibility policy</PanelAction>}>
          <Table><thead><tr><th>Rule</th><th>Result</th><th>Why</th></tr></thead><tbody>{q.checks.map((k: any) => <tr key={k.code} title={k.code}><td className="text-[13px]">{REASON_LABEL[k.code] ?? k.code}</td><td>{k.pass ? <span className="text-[12px] text-success">passes</span> : <span className="text-[12px] font-medium text-danger">fails</span>}</td><td className="text-[13px]">{k.detail}</td></tr>)}</tbody></Table>
          <WhatIf id={c.id} />
        </Panel>
      ) : null}
      {tab === 'cases' ? <Panel icon={<Wallet size={16} />} title={d.cases.length ? `${d.cases.length} case${d.cases.length === 1 ? '' : 's'}` : 'No cases'}><Table><thead><tr><th>What stood in the way</th><th>Where it stands</th><th>Opened</th><th>Closed</th></tr></thead><tbody>{d.cases.map((k: any) => <tr key={k.id} className="clickable" onClick={() => openCase(k.ref)} title={k.ref}><td className="text-[13px]">{k.reasons.map((r: string) => REASON_LABEL[r] ?? r).join(' · ')}<span className="block text-[11px] text-muted-foreground">{CLASS_LABEL[k.cls]}</span></td><td><StatusChip status={k.state} /> {k.close_code ? <StatusChip status={k.close_code} /> : null}</td><td className="text-[12px]">{date(k.opened_at)}</td><td className="text-[12px]">{k.closed_at ? date(k.closed_at) : '—'}</td></tr>)}</tbody></Table>{!d.cases.length ? <Empty>Eligible at every scan.</Empty> : null}</Panel> : null}
      {tab === 'comms' ? <Panel icon={<Smartphone size={16} />} title="Messages to the customer" action={<PanelAction onClick={() => go('comms', `customer=${c.id}`)}>All messages</PanelAction>}><Messages rows={d.messages} />{d.inbound.length ? <><p className="mt-4 text-[12px] text-muted-foreground">What the customer sent</p><ul className="mt-1 space-y-1 text-[12px]">{d.inbound.map((i: any) => <li key={i.id}><span className="text-muted-foreground">{dateTime(i.received_at)} · {String(i.channel).toLowerCase()}</span> <StatusChip status={i.classification} /> {i.body}</li>)}</ul></> : null}</Panel> : null}
      {tab === 'docs' ? <Panel icon={<FileText size={16} />} title="Documents and proposed updates"><ul className="space-y-1 text-[12px]">{d.documents.map((doc: any) => <li key={doc.id} className="flex flex-wrap items-center gap-2"><button type="button" className="font-medium text-primary" onClick={() => open(`document:${doc.id}`)}>{(DOC_LABEL[doc.type] ?? doc.type).replace(/^[a-z]/, (s: string) => s.toUpperCase())}</button><StatusChip status={doc.state} />{doc.recommendation ? <span className={doc.recommendation === 'APPROVE' ? 'text-success' : 'text-danger'}>{doc.recommendation.toLowerCase()} recommended</span> : null}<span className="text-muted-foreground">{dateTime(doc.received_at)}</span></li>)}</ul>{!d.documents.length ? <Empty>No documents received.</Empty> : null}<div className="mt-2"><Proposals rows={d.proposals} /></div></Panel> : null}
      {tab === 'trail' ? <Panel icon={<ShieldCheck size={16} />} title="Trail"><TrailList rows={d.trail} /></Panel> : null}
      {persona?.key === 'rm' && openK ? <p className="text-[11px] text-muted-foreground">You own every contact with this client.</p> : null}
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
      <p className="text-[12px] text-muted-foreground">What if…</p>
      <div className="mt-2 flex flex-wrap items-center gap-3 text-[12px]"><input className="input h-8 w-36" placeholder="salary QAR" value={salary} onChange={(e) => setSalary(e.target.value.replace(/\D/g, ''))} /><label className="flex items-center gap-1"><input type="checkbox" checked={qid} onChange={(e) => setQid(e.target.checked)} />documents renewed</label><label className="flex items-center gap-1"><input type="checkbox" checked={emp} onChange={(e) => setEmp(e.target.checked)} />employer approved</label><label className="flex items-center gap-1"><input type="checkbox" checked={dropSo} onChange={(e) => setDropSo(e.target.checked)} />standing orders reclassified</label><label className="flex items-center gap-1"><input type="checkbox" checked={clearDpd} onChange={(e) => setClearDpd(e.target.checked)} />arrears paid</label></div>
      {data?.whatIf ? <p className="mt-2 text-sm">{data.whatIf.eligible ? <><span className="font-medium text-success">Eligible:</span> {qar(data.whatIf.amount)} over {data.whatIf.inputs.tenor} months</> : <><span className="font-medium text-danger">Still not eligible:</span> {data.whatIf.reasons.map((k: string) => REASON_LABEL[k] ?? k).join(', ')}</>}</p> : null}
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
  return <Panel title="Your decision on this customer's case"><Recommendation run={run} /><div className="mt-2"><Decide run={run} onDone={() => { bump(); reload(); }} /></div></Panel>;
}

export function EmployersScreen() {
  const { route } = useApp();
  const id = route.param && !route.param.includes('=') ? route.param : null;
  if (id) return <EmployerDetail id={id} />;
  return <EmployerList />;
}

/** The register: customers who wait only on each employer's approval, as one sorted bar on one scale, and the five criteria as segments. */
function EmployerList() {
  const { go } = useApp();
  const [q, setQ] = useState(''); const [status, setStatus] = useState('');
  const { data } = useApi<any[]>(`/employers?q=${encodeURIComponent(q)}&status=${status}`);
  const rows = [...(data ?? [])].sort((a, b) => (b.only_this ?? 0) - (a.only_this ?? 0) || b.blocked - a.blocked || b.staff - a.staff);
  const max = Math.max(1, ...rows.map((e) => e.blocked));
  const top = rows[0];
  const freeable = rows.filter((e) => e.approval_status !== 'APPROVED').reduce((s, e) => s + (e.only_this ?? 0), 0);
  const claim = !data ? 'Employers' : top && top.only_this ? `Approving ${top.name_en} would free ${num(top.only_this)} customer${top.only_this === 1 ? '' : 's'} tonight` : 'No customer waits only on an employer approval';
  return (
    <Screen hero={<Hero eyebrow="Employers · the approved list" title={claim} lede={data ? `${num(freeable)} customers in all wait only on an employer approval; one Credit Policy decision re-qualifies every customer of that employer at once.` : undefined} />}>
      <div className="flex flex-wrap gap-2"><input className="input" placeholder="Find an employer" value={q} onChange={(e) => setQ(e.target.value)} /><Select value={status} onChange={setStatus}><option value="">Every status</option><option value="UNAPPROVED">Not approved</option><option value="UNDER_REVIEW">Under review</option><option value="APPROVED">Approved</option><option value="RESTRICTED">Restricted</option></Select></div>
      <Panel icon={<Building2 size={16} />} title={`${num(rows.length)} employers, the most customers freed first`}>
        <Table><thead><tr><th>Employer</th><th>Status</th><th style={{ width: 300 }}>Customers freed by an approval</th><th style={{ width: 160 }}>The five criteria</th><th>QIB-salaried</th></tr></thead>
          <tbody>{rows.map((e) => {
            const met = (e.criteria ?? []).filter((c: any) => c.ok).length;
            return (
              <tr key={e.id} className="clickable" onClick={() => go('employers', e.id)} title={e.id}>
                <td><span className="block text-sm font-medium">{e.name_en}</span><span className="text-[11px] text-muted-foreground">{lc(title(e.sector))} · {num(e.headcount)} staff</span></td>
                <td><StatusChip status={e.approval_status === 'UNDER_REVIEW' ? 'UNDER_REVIEW_E' : e.approval_status} /></td>
                <td>{e.blocked ? (
                  <div className="flex items-center gap-2">
                    <div className="relative h-2.5 flex-1 rounded-full bg-muted" title={`${e.only_this ?? 0} wait only on this approval; ${e.blocked} have it among their reasons`}>
                      <div className="absolute inset-y-0 start-0 rounded-full bg-primary/30" style={{ width: `${(e.blocked / max) * 100}%` }} />
                      <div className="absolute inset-y-0 start-0 rounded-full bg-primary" style={{ width: `${((e.only_this ?? 0) / max) * 100}%` }} />
                    </div>
                    <span className="w-16 text-end font-mono text-[12px]">{num(e.only_this ?? 0)}{e.blocked > (e.only_this ?? 0) ? <span className="text-muted-foreground"> +{e.blocked - (e.only_this ?? 0)}</span> : null}</span>
                  </div>
                ) : <span className="text-[12px] text-muted-foreground">none waiting</span>}</td>
                <td>{e.criteria?.length ? <div title={e.criteria.map((c: any) => `${c.ok ? '✓' : '✗'} ${c.label}: ${c.value}`).join('\n')}><Segments items={e.criteria.map((c: any) => ({ label: c.label, on: c.ok }))} /><span className={`mt-1 block text-[11px] ${met === e.criteria.length ? 'text-muted-foreground' : 'text-danger'}`}>{met === e.criteria.length ? 'all five met' : `${e.criteria.length - met} not met`}</span></div> : null}</td>
                <td className="font-mono text-[12px]">{num(e.staff)}</td>
              </tr>
            );
          })}</tbody></Table>
        <p className="mt-2 text-[11px] text-muted-foreground">The dark bar is the customers who wait only on that approval; the light bar adds those who also need something else (the number after the +). One scale for every row.</p>
      </Panel>
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
  const isOnly = (s: any) => (s.live_eligible ?? s.eligible) === false && (s.live_reasons ?? s.reason_codes ?? []).length === 1 && (s.live_reasons ?? s.reason_codes)[0] === 'R02';
  const blocked = d.staff.filter((s: any) => (s.live_eligible ?? s.eligible) === false && (s.live_reasons ?? s.reason_codes ?? []).includes('R02')).length;
  const only = d.staff.filter(isOnly).length;
  const claim = e.approval_status === 'APPROVED' ? `${e.name_en} is approved; no customer waits on it` : only ? `Approving ${e.name_en} would free ${num(only)} of its ${num(d.staff.length)} QIB-salaried customers` : `${e.name_en} is not approved; ${num(blocked)} customers have it among their reasons`;
  return (
    <Screen hero={<Hero eyebrow={<span title={e.id}>Employer · <span className="ar">{e.name_ar}</span> · {lc(title(e.sector))} · {num(e.headcount)} staff · {e.months_operating} months operating · WPS {e.wps_active ? 'active' : 'inactive'}</span>} title={claim}
      actions={<><Btn onClick={() => go('employers')}>All employers</Btn>{d.can.open && e.approval_status !== 'APPROVED' && !d.run ? <Btn kind="primary" onClick={async () => { try { const r = await post(`/employers/${e.id}/review`); setMsg(r.note); bump(); reload(); } catch (x: any) { setMsg(x.message); } }}>Open an employer review</Btn> : null}</>} />}>
      {msg ? <Note>{msg}</Note> : null}
      {pack ? (
        <Panel icon={<ShieldCheck size={16} />} title={`Muwathiq recommends ${pack.recommendation === 'APPROVE' ? 'approving' : pack.recommendation === 'DECLINE' ? 'declining' : 'a closer look'}: ${pack.criteria.filter((c: any) => c.ok).length} of ${pack.criteria.length} criteria met`} action={<StatusChip status={pack.mode} />}>
          <Table><thead><tr><th>Criterion</th><th>Value</th><th>Required</th><th>Result</th></tr></thead><tbody>{pack.criteria.map((c: any) => <tr key={c.key} title={c.clause}><td>{c.label}</td><td className="text-[12px]">{c.value}</td><td className="text-[12px] text-muted-foreground">{c.required}</td><td>{c.ok ? <span className="text-[12px] text-success">met</span> : <span className="text-[12px] font-medium text-danger">not met</span>}</td></tr>)}</tbody></Table>
          <p className="mt-2 text-sm leading-relaxed">{pack.narrative}</p>
          <p className="mt-1 text-[11px] text-muted-foreground">Review {rv.state.toLowerCase()} · opened {dateTime(rv.opened_at)}{rv.decided_by ? ` · decided by ${PERSONA_SHORT[rv.decided_by] ?? rv.decided_by} ${dateTime(rv.decided_at)}: ${rv.reason ?? ''}` : ''}</p>
          {mine ? <div className="mt-3"><Recommendation run={run} /><div className="mt-2"><Decide run={run} onDone={() => { bump(); reload(); }} /></div></div> : d.run?.status === 'WAITING' ? <p className="mt-2 text-[12px] text-muted-foreground">Waiting on the {PERSONA_SHORT[d.run.waiting_on_persona]}.</p> : null}
        </Panel>
      ) : null}
      <Panel icon={<UserRound size={16} />} title={`${d.staff.length} QIB-salaried customers${only ? `, ${num(only)} waiting only on this approval` : ''}`}>
        <Table><thead><tr><th>Customer</th><th>Salary</th><th style={{ width: 260 }}>The twenty rules</th><th>Case</th></tr></thead><tbody>{[...d.staff].sort((a: any, b: any) => Number(isOnly(b)) - Number(isOnly(a))).map((s: any) => (
          <tr key={s.id} className="clickable" onClick={() => go('customers', s.id)} title={s.id}>
            <td><span className="block text-sm">{s.name_en}</span><span className="text-[11px] text-muted-foreground">{SEG[s.segment] ?? s.segment}{isOnly(s) ? ' · freed by this approval' : ''}</span></td>
            <td className="font-mono text-[12px]">{qar(s.salary_total)}</td>
            <td><RuleDots checks={checksOf((s.live_reasons ?? s.reason_codes ?? []).filter((r: string) => r !== 'R20'))} /></td>
            <td className="text-[12px]">{s.case_ref ? <button type="button" className="text-primary" title={s.case_ref} onClick={(ev) => { ev.stopPropagation(); openCase(s.case_ref); }}>Open the case</button> : '—'}</td>
          </tr>))}</tbody></Table>
      </Panel>
      <Panel icon={<ShieldCheck size={16} />} title="Trail"><TrailList rows={d.trail} compact /></Panel>
    </Screen>
  );
}
