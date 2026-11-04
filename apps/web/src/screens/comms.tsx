/**
 * Messages — "What went out, what did Hami stop, and why?" (Compliance,
 * Operations). A heading with the claim, four tabs (Sent · Scheduled ·
 * Blocked · Inbound), the list on the left and Hami's blocks by rule as one
 * sorted bar beside it. The policy version, the approver and the window are in
 * each row's expansion; the mailbox simulator and the templates are behind one
 * menu named for them (the rig, not the work).
 */
import { useEffect, useState } from 'react';
import { Panel, PageColumns } from '@cognirise/cognipulse/layout';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@cognirise/cognipulse/components/ui/dropdown-menu';
import { ChevronDown, Mail, MessageSquare, Inbox as InboxIcon, FileText, Loader2, Paperclip, ShieldAlert } from 'lucide-react';
import { bump, post, useApi } from '../lib/api';
import { dateTime, num, rel, title } from '../lib/format';
import { useApp, useFlash } from '../app/state';
import { Btn, Chip, Empty, Hero, Screen, Select, StatusChip, Table, Tabs, Ref, SEG } from '../app/ui';

const parse = (p: string | null) => { const o: Record<string, string> = {}; if (!p) return o; for (const kv of p.split('&')) { const [k, v] = kv.split('='); o[k] = decodeURIComponent(v ?? ''); } return o; };
const CHANNEL: Record<string, string> = { PUSH: 'Push', INAPP: 'In-app', EMAIL: 'E-mail', SMS: 'SMS', WHATSAPP: 'WhatsApp', CALL: 'Call', LETTER: 'Letter', RM: 'Relationship manager', BRANCH: 'Branch' };
const REPLY: Record<string, string> = { DOCUMENT: 'A document', QUESTION: 'A question', DISPUTE: 'A dispute', OPT_OUT: 'An opt-out', HARDSHIP: 'Hardship', COMPLAINT: 'A complaint', OUT_OF_OFFICE: 'An out-of-office', UNRELATED: 'Something unrelated', ACCEPT: 'An acceptance' };
type Tab = 'all' | 'sent' | 'scheduled' | 'blocked' | 'inbound' | 'mailbox' | 'templates';
const tabOf = (q: Record<string, string>): Tab => q.mailbox ? 'mailbox' : q.status === 'BLOCKED' ? 'blocked' : q.status === 'SCHEDULED' ? 'scheduled' : q.customer ? 'all' : 'sent';

export function CommsScreen() {
  const { route, go } = useApp();
  const p = parse(route.param);
  const [tab, setTab] = useState<Tab>(tabOf(p));
  const [customer, setCustomer] = useState(p.customer ?? p.mailbox ?? '');
  const [channel, setChannel] = useState(''); const [type, setType] = useState(''); const [page, setPage] = useState(0);
  useEffect(() => { const q = parse(route.param); setCustomer(q.customer ?? q.mailbox ?? ''); setTab(tabOf(q)); setPage(0); }, [route.param]);
  const status = tab === 'blocked' ? 'BLOCKED' : tab === 'scheduled' ? 'SCHEDULED' : tab === 'sent' ? 'SENT' : '';
  const outbound = tab === 'all' || tab === 'sent' || tab === 'scheduled' || tab === 'blocked';
  const qs = new URLSearchParams({ status, channel, customer, type, page: String(page), size: '60' }).toString();
  // The counts for the heading and the blocks by rule come with any outbound page; on the other tabs the first page of everything is asked for them.
  const { data, error } = useApi<any>(`/comms?${outbound ? qs : 'size=1'}`, { poll: 12000 });
  const overall: Record<string, number> = Object.fromEntries(((data?.overall ?? []) as any[]).map((s) => [s.status, s.n]));
  const sent = (overall.SENT ?? 0) + (overall.DELIVERED ?? 0), blocked = overall.BLOCKED ?? 0, scheduled = overall.SCHEDULED ?? 0;
  const pick = (t: Tab) => { setTab(t); setPage(0); };
  const rig = tab === 'mailbox' || tab === 'templates';
  return (
    <Screen hero={<Hero eyebrow="Messages" title={`${num(sent)} message${sent === 1 ? '' : 's'} went out; Hami stopped ${num(blocked)}`} lede={`${num(scheduled)} wait their turn inside the contact window. Every message is checked by Hami when it falls due; a stopped message names the rule that stopped it.`} />}>
      <div className="flex flex-wrap items-center gap-2">
        <Tabs value={tab} onChange={(t) => pick(t as Tab)} tabs={[{ id: 'sent', label: 'Sent', n: sent }, { id: 'scheduled', label: 'Scheduled', n: scheduled }, { id: 'blocked', label: 'Blocked', n: blocked }, { id: 'inbound', label: 'Inbound' }]} />
        <DropdownMenu>
          <DropdownMenuTrigger asChild><button type="button" className={`pill-btn pill-btn-ghost px-3 py-1.5 text-xs ${rig ? 'border-primary text-primary' : ''}`}>The customer's mailbox and the templates <ChevronDown className="ms-1 h-3 w-3" /></button></DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onSelect={() => pick('mailbox')}>The customer's mailbox (simulated)</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => pick('templates')}>The approved templates</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        {outbound || tab === 'inbound' ? (
          <div className="ms-auto flex flex-wrap items-center gap-2">
            {customer && outbound ? <button type="button" className="mono-chip is-primary" title="Show every customer again" onClick={() => { setCustomer(''); if (tab === 'all') setTab('sent'); }}>One customer ×</button> : null}
            {outbound ? <>
              <input className="input h-8 w-44 text-[13px]" placeholder="Customer id" value={customer} onChange={(e) => { setCustomer(e.target.value.toUpperCase()); setPage(0); }} />
              <Select className="h-8 text-[13px]" value={channel} onChange={(v) => { setChannel(v); setPage(0); }}><option value="">Every channel</option>{['PUSH', 'INAPP', 'EMAIL', 'SMS', 'LETTER', 'RM', 'CALL'].map((c) => <option key={c} value={c}>{CHANNEL[c] ?? c}</option>)}</Select>
              <Select className="h-8 text-[13px]" value={type} onChange={(v) => { setType(v); setPage(0); }}><option value="">Service and offers</option><option value="service">Service messages</option><option value="marketing">Offers</option></Select>
            </> : null}
          </div>
        ) : null}
      </div>
      {error ? <Empty>{error}</Empty> : null}
      {tab === 'templates' ? <Templates /> : tab === 'mailbox' ? <Mailbox customerId={customer || p.mailbox || ''} onPick={(id) => { setCustomer(id); go('comms', `mailbox=${id}`); }} /> : (
        <PageColumns aside={<Blocks rows={data?.byBlock ?? []} total={blocked} onOpen={() => pick('blocked')} />}>
          {tab === 'inbound' ? <Inbound /> : (
            <Panel icon={<MessageSquare size={16} />} title={tab === 'all' ? `${num(data?.total ?? 0)} messages to this customer` : tab === 'blocked' ? `${num(data?.total ?? 0)} stopped by Hami` : tab === 'scheduled' ? `${num(data?.total ?? 0)} scheduled` : `${num(data?.total ?? 0)} sent`} action={(data?.total ?? 0) > 60 ? <span className="flex items-center gap-2 text-[12px] text-muted-foreground"><Btn small onClick={() => setPage((x) => Math.max(0, x - 1))} disabled={page === 0}>Previous</Btn>page {page + 1}<Btn small onClick={() => setPage((x) => x + 1)} disabled={(page + 1) * 60 >= (data?.total ?? 0)}>Next</Btn></span> : undefined}>
              <MessageTable rows={data?.rows ?? []} now={data?.now} />
            </Panel>
          )}
        </PageColumns>
      )}
    </Screen>
  );
}

/** A block reason in the person's words: channel codes spelled out. */
const plainReason = (s: string) => String(s ?? '').replace(/\b(EMAIL|INAPP|PUSH|SMS|WHATSAPP|CALL|LETTER)\b/g, (m) => m === 'SMS' ? m : (CHANNEL[m] ?? m).toLowerCase());

/** Hami's blocks by rule, as one sorted bar on one scale. */
function Blocks({ rows, total, onOpen }: { rows: { reason: string; clause: string | null; n: number }[]; total: number; onOpen: () => void }) {
  const max = Math.max(1, ...rows.map((r) => r.n));
  const top = rows[0];
  return (
    <Panel icon={<ShieldAlert size={16} />} title={top ? `Hami stopped ${num(total)}; ${num(top.n)} for one rule` : 'Hami has stopped nothing'}>
      {rows.length ? (
        <ul className="space-y-2">
          {rows.map((r) => (
            <li key={r.reason}>
              <button type="button" className="block w-full text-start hover:text-primary" onClick={onOpen} title={`${plainReason(r.reason)}${r.clause ? ` · ${r.clause}` : ''}`}>
                <span className="flex items-baseline gap-2 text-[13px]"><span className="min-w-0 flex-1 leading-snug">{plainReason(r.reason)}</span><span className="font-mono text-[12px] tabular-nums">{num(r.n)}</span></span>
                <span className="mt-1 block h-2 w-full overflow-hidden rounded-full bg-muted"><span className="block h-full rounded-full bg-danger/80" style={{ width: `${(r.n / max) * 100}%` }} /></span>
              </button>
            </li>
          ))}
        </ul>
      ) : <p className="text-[13px] text-muted-foreground">Every message that fell due passed the contact rules.</p>}
      <p className="mt-3 text-[11px] leading-snug text-muted-foreground">A block on the channel moves the message to the next channel allowed; a block on the customer (do not contact, no consent, arrears, a pause) stops it; the contact cap defers it to the next day.</p>
    </Panel>
  );
}

/** Outbound messages: when, to whom, by which channel, what, and its state; the body and the policy that let it go behind a click on the row. */
function MessageTable({ rows, now }: { rows: any[]; now?: string }) {
  if (!rows.length) return <Empty>No message matches.</Empty>;
  return (
    <Table>
      <thead><tr><th>When</th><th>Customer</th><th>Channel</th><th>Message</th><th>State</th></tr></thead>
      <tbody>{rows.map((m) => <MessageRow key={m.id} m={m} now={now} />)}</tbody>
    </Table>
  );
}
function MessageRow({ m, now }: { m: any; now?: string }) {
  const flash = useFlash('messages', m.id, true);
  const { open, openCase, go } = useApp();
  const [expanded, setExpanded] = useState(false);
  const at = m.sent_at ?? m.scheduled_for;
  return (
    <>
      <tr className={`clickable ${flash}`} onClick={() => setExpanded((o) => !o)} title={`${m.customer_id}${m.case_ref ? ` · ${m.case_ref}` : ''}`}>
        <td className="whitespace-nowrap text-[12px]"><span className="block">{dateTime(at)}</span><span className="text-muted-foreground">{rel(at, now)}</span></td>
        <td><span className="block text-sm">{m.name_en}</span><span className="text-[11px] text-muted-foreground">{SEG[m.segment] ?? ''}</span></td>
        <td className="text-[12px]">{CHANNEL[m.channel] ?? m.channel}</td>
        <td>
          <span className="block text-sm">{title(m.message_type)}{m.attempt ? <span className="text-muted-foreground"> · notice {m.attempt}</span> : null}{m.marketing ? <Chip tone="warn" className="ms-1">offer</Chip> : null}</span>
          <span className="block truncate text-[12px] text-muted-foreground" style={{ maxWidth: 420 }}>{m.subject}</span>
          {m.block_reason ? <span className="block text-[12px] text-danger">Stopped: {plainReason(m.block_reason)}</span> : null}
          {m.meta?.deferred ? <span className="block text-[12px] text-warn">Deferred {m.meta.deferred} time{m.meta.deferred === 1 ? '' : 's'} by the contact cap</span> : null}
        </td>
        <td><StatusChip status={m.status} /></td>
      </tr>
      {expanded ? (
        <tr><td colSpan={5} className="bg-muted/30">
          <div className={`whitespace-pre-wrap rounded-lg border border-border/60 bg-card/60 p-3 text-[13px] leading-relaxed ${m.lang === 'ar' ? 'ar text-end' : ''}`} dir={m.lang === 'ar' ? 'rtl' : 'ltr'}><p className="mb-1 font-semibold">{m.subject}</p>{m.body}</div>
          <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-muted-foreground">
            <span>Under policy version {m.policy_version}</span>
            {m.approved_by ? <span>approved by {m.approved_by}</span> : null}
            {m.window_used ? <span>sent in the {String(m.window_used).toLowerCase()} window</span> : null}
            {m.block_clause ? <button type="button" className="text-primary" onClick={() => go('policies', String(m.block_clause))}>The rule that stopped it</button> : null}
            {m.case_ref ? <button type="button" className="text-primary" onClick={() => openCase(m.case_ref)}>Open the case</button> : null}
            <button type="button" className="text-primary" onClick={() => open(`customer:${m.customer_id}`)}>The customer</button>
          </p>
        </td></tr>
      ) : null}
    </>
  );
}

function Inbound() {
  const { data } = useApi<any[]>('/comms/inbound', { poll: 12000 });
  const { openCase, open } = useApp();
  const rows = data ?? [];
  return (
    <Panel icon={<InboxIcon size={16} />} title={`${num(rows.length)} replies, uploads and e-mails from customers`}>
      <ul className="space-y-2">{rows.map((i) => (
        <li key={i.id} className="rounded-lg border border-border/60 bg-card/50 p-2.5 text-[13px]" title={`${i.customer_id ?? 'unmatched'}${i.case_ref ? ` · ${i.case_ref}` : ''}`}>
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-muted-foreground">
            <span>{dateTime(i.received_at)}</span><span>·</span><span>{CHANNEL[i.channel] ?? i.channel}</span><span>·</span>
            {i.customer_id ? <button type="button" className="font-medium text-foreground hover:text-primary" onClick={() => open(`customer:${i.customer_id}`)}>{i.name_en ?? 'the customer'}</button> : <Chip tone="warn">no customer matched</Chip>}
            {i.classification ? <span className="ms-auto font-medium text-foreground">{REPLY[i.classification] ?? title(i.classification)}</span> : null}
          </p>
          {i.subject ? <p className="mt-1 font-medium">{i.subject}</p> : null}<p className="mt-0.5">{i.body}</p>
          {(i.attachments ?? []).length ? <p className="mt-0.5 flex items-center gap-1 text-[12px] text-muted-foreground"><Paperclip className="h-3 w-3" />{i.attachments.map((a: any) => a.name).join(', ')}</p> : null}
          {i.routed_to || i.case_ref ? <p className="mt-1 flex flex-wrap gap-3 text-[12px] text-muted-foreground">{i.routed_to ? <span>Mustaqbil sent it to {i.routed_to}</span> : null}{i.case_ref ? <button type="button" className="text-primary" onClick={() => openCase(i.case_ref)}>Open the case</button> : null}</p> : null}
        </li>))}</ul>
      {!rows.length ? <Empty>No inbound messages yet.</Empty> : null}
    </Panel>
  );
}

function Templates() {
  const { data } = useApi<any[]>('/comms/templates');
  const [lang, setLang] = useState<'en' | 'ar'>('en');
  const [type, setType] = useState('REQUEST');
  const types = [...new Set((data ?? []).map((t) => t.type as string))];
  const rows = (data ?? []).filter((t) => t.lang === lang && t.type === type);
  return (
    <Panel icon={<FileText size={16} />} title="The approved templates, one per reason, kind and language" action={<div className="flex gap-2"><Select value={type} onChange={setType}>{types.map((t) => <option key={t} value={t}>{title(t)}</option>)}</Select><Select value={lang} onChange={(v) => setLang(v as any)}><option value="en">English</option><option value="ar">Arabic</option></Select></div>}>
      <div className="grid gap-3 md:grid-cols-2">{rows.map((t) => <div key={t.key} title={t.key} className={`rounded-xl border border-border/60 bg-card/50 p-3 text-[12px] ${lang === 'ar' ? 'ar text-end' : ''}`} dir={lang === 'ar' ? 'rtl' : 'ltr'}><p className="flex items-center gap-2">{t.marketing ? <Chip tone="warn">offer · needs consent</Chip> : <Chip>service</Chip>}</p><p className="mt-1 font-semibold">{t.subject}</p><p className="mt-1 whitespace-pre-wrap leading-relaxed">{t.body}</p></div>)}</div>
      <p className="mt-2 text-[11px] text-muted-foreground">Every body names the sender, the purpose, how to opt out and the reference (CRA art. 6(4)); push and SMS are shortened from it. Placeholders in braces are filled per customer when the message is sent.</p>
    </Panel>
  );
}

/** The customer's inbox as they see it, with a reply composer that feeds the same inbound pipeline. */
export function Mailbox({ customerId, onPick }: { customerId: string; onPick: (id: string) => void }) {
  const { data, error, reload } = useApi<any>(customerId ? `/customer/${customerId}/mailbox` : null, { poll: 10000 });
  const [sel, setSel] = useState<number | null>(null);
  const [subject, setSubject] = useState(''); const [body, setBody] = useState(''); const [specimen, setSpecimen] = useState(''); const [busy, setBusy] = useState(false); const [msg, setMsg] = useState('');
  const [pick, setPick] = useState(customerId);
  const mails = data?.mails ?? [];
  const m = mails.find((x: any) => x.id === sel) ?? mails[0];
  useEffect(() => { if (m && !subject) setSubject(`Re: ${m.subject ?? ''}`.slice(0, 120)); }, [m, subject]);
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2"><input className="input" placeholder="Customer id" value={pick} onChange={(e) => setPick(e.target.value.toUpperCase())} /><Btn small onClick={() => onPick(pick)}>Open the mailbox</Btn>{data ? <span className="text-[12px] text-muted-foreground">{data.customer.nameEn} · {data.customer.email}{data.caseRef ? <> · open case <Ref>{data.caseRef}</Ref></> : null}</span> : null}</div>
      {error ? <Empty>{error}</Empty> : null}
      {data ? (
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
          <Panel icon={<Mail size={16} />} title="The customer's inbox (simulated)">
            <div className="divide-y divide-border/40 rounded-lg border border-border/60">{mails.map((x: any) => <div key={x.id} className={`mail-row ${m?.id === x.id ? 'bg-primary/5' : ''}`} onClick={() => setSel(x.id)}><div className="min-w-0"><p className="truncate text-[13px] font-medium">{x.subject}</p><p className="truncate text-[12px] text-muted-foreground">{x.kind === 'OUTGOING' ? 'You → QIB' : 'QIB · Jahiz'} · {String(x.body).replace(/\s+/g, ' ').slice(0, 80)}</p></div><span className="text-[11px] text-muted-foreground">{dateTime(x.at)}</span></div>)}{!mails.length ? <p className="p-3 text-[12px] text-muted-foreground">No e-mail yet for this customer.</p> : null}</div>
          </Panel>
          <div className="space-y-3">
            {m ? <Panel title={m.subject ?? '(no subject)'} action={<Chip>{m.kind === 'OUTGOING' ? 'sent by the customer' : m.lang === 'ar' ? 'Arabic' : 'English'}</Chip>}><p className="text-[12px] text-muted-foreground">{m.kind === 'OUTGOING' ? `To: oneclick@qib.demo` : `From: Qatar Islamic Bank <noreply@qib.demo>`} · {dateTime(m.at)}</p><div className={`mt-2 whitespace-pre-wrap text-[13px] leading-relaxed ${m.lang === 'ar' ? 'ar text-end' : ''}`} dir={m.lang === 'ar' ? 'rtl' : 'ltr'}>{m.body}</div></Panel> : null}
            <Panel icon={<Paperclip size={16} />} title="Reply as the customer">
              <div className="space-y-2"><input className="input w-full" placeholder="Subject" value={subject} onChange={(e) => setSubject(e.target.value)} /><textarea className="input w-full" placeholder="Message (try 'Please find my renewed ID attached', 'I lost my job last month', 'STOP', or a question)" value={body} onChange={(e) => setBody(e.target.value)} />
                <div className="flex flex-wrap items-center gap-2"><Select value={specimen} onChange={setSpecimen}><option value="">No attachment</option>{(data.specimens ?? []).map((s: any) => <option key={s.kind} value={s.kind}>{s.label}{s.flaw ? ' ⚠' : ''}</option>)}</Select>
                  <Btn kind="primary" small disabled={busy || (!body && !specimen)} onClick={async () => { setBusy(true); setMsg(''); try { const r = await post(`/customer/${customerId}/email`, { subject, body: body || 'Please see attached.', specimen: specimen || undefined }); setMsg(`Received with ${r.documentIds.length} attachment${r.documentIds.length === 1 ? '' : 's'}: Mustaqbil classifies it, Fahis reads what is attached, a checker decides.`); setBody(''); setSpecimen(''); bump(); reload(); } catch (e: any) { setMsg(e.message); } finally { setBusy(false); } }}>{busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}Send to QIB</Btn></div>
                {msg ? <p className="text-[12px] text-muted-foreground">{msg}</p> : null}
                <p className="text-[11px] text-muted-foreground">In production this inbox is a shared mailbox read through Microsoft Graph; the reply enters the same pipeline, matched by the case reference in the subject or by the sender. A document sent by e-mail always needs the checker.</p>
              </div>
            </Panel>
          </div>
        </div>
      ) : <Empty>Pick a customer to open their mailbox.</Empty>}
    </div>
  );
}
