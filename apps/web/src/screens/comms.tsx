/** Communications — everything said to and by customers: sent, scheduled, blocked, inbound, templates, and the mailbox simulator. */
import { useEffect, useMemo, useState } from 'react';
import { Panel, StatRow, StatTile } from '@cognirise/atelier/layout';
import { Mail, MessageSquare, Inbox as InboxIcon, FileText, Loader2, Paperclip } from 'lucide-react';
import { bump, post, useApi } from '../lib/api';
import { dateTime, num, title } from '../lib/format';
import { useApp } from '../app/state';
import { Messages } from '../app/case';
import { Btn, Chip, Empty, Hero, Note, Screen, Select, StatusChip, Tabs, Ref } from '../app/ui';

const parse = (p: string | null) => { const o: Record<string, string> = {}; if (!p) return o; for (const kv of p.split('&')) { const [k, v] = kv.split('='); o[k] = decodeURIComponent(v ?? ''); } return o; };

export function CommsScreen() {
  const { route, go } = useApp();
  const p = parse(route.param);
  const [tab, setTab] = useState(p.mailbox ? 'mailbox' : p.status === 'BLOCKED' ? 'blocked' : p.status === 'SCHEDULED' ? 'scheduled' : 'all');
  const [customer, setCustomer] = useState(p.customer ?? p.mailbox ?? '');
  const [channel, setChannel] = useState(''); const [type, setType] = useState(''); const [page, setPage] = useState(0);
  useEffect(() => { const q = parse(route.param); setCustomer(q.customer ?? q.mailbox ?? ''); setTab(q.mailbox ? 'mailbox' : q.status === 'BLOCKED' ? 'blocked' : q.status === 'SCHEDULED' ? 'scheduled' : 'all'); setPage(0); }, [route.param]);
  const status = tab === 'blocked' ? 'BLOCKED' : tab === 'scheduled' ? 'SCHEDULED' : tab === 'sent' ? 'SENT' : '';
  const qs = new URLSearchParams({ status, channel, customer, type, page: String(page), size: '60' }).toString();
  const { data, error } = useApi<any>(tab !== 'inbound' && tab !== 'templates' && tab !== 'mailbox' ? `/comms?${qs}` : null, { poll: 12000 });
  const stats = useMemo(() => Object.fromEntries(((data?.stats ?? []) as any[]).map((s) => [s.status, s.n])), [data]);
  return (
    <Screen hero={<Hero eyebrow="Communications" title="Everything said to and by customers" lede="Outbound messages are scheduled inside the policy window, checked by Hami when due and delivered to the customer's phone or mailbox; a blocked message carries the clause." />}>
      <StatRow><StatTile label="Sent" value={num(stats.SENT ?? 0)} /><StatTile label="Scheduled" value={num(stats.SCHEDULED ?? 0)} /><StatTile label="Blocked by Hami" value={num(stats.BLOCKED ?? 0)} /><StatTile label="Cancelled" value={num(stats.CANCELLED ?? 0)} /></StatRow>
      <div className="flex flex-wrap items-center gap-2">
        <Tabs value={tab} onChange={setTab} tabs={[{ id: 'all', label: 'All outbound' }, { id: 'scheduled', label: 'Scheduled' }, { id: 'blocked', label: 'Blocked' }, { id: 'sent', label: 'Sent' }, { id: 'inbound', label: 'Inbound' }, { id: 'mailbox', label: 'Mailbox simulator' }, { id: 'templates', label: 'Templates' }]} />
        {tab !== 'templates' && tab !== 'mailbox' ? <><input className="input" placeholder="Customer DEMO id" value={customer} onChange={(e) => { setCustomer(e.target.value.toUpperCase()); setPage(0); }} /><Select value={channel} onChange={(v) => { setChannel(v); setPage(0); }}><option value="">All channels</option>{['PUSH', 'INAPP', 'EMAIL', 'SMS', 'LETTER', 'RM', 'CALL'].map((c) => <option key={c} value={c}>{c}</option>)}</Select><Select value={type} onChange={(v) => { setType(v); setPage(0); }}><option value="">Service and offers</option><option value="service">Service messages</option><option value="marketing">Offers (marketing)</option></Select></> : null}
      </div>
      {error ? <Empty>{error}</Empty> : null}
      {tab === 'inbound' ? <Inbound /> : tab === 'templates' ? <Templates /> : tab === 'mailbox' ? <Mailbox customerId={customer || p.mailbox || ''} onPick={(id) => { setCustomer(id); go('comms', `mailbox=${id}`); }} /> : (
        <Panel icon={<MessageSquare size={16} />} title={`${num(data?.total ?? 0)} message(s)`} action={<span className="text-[12px] text-muted-foreground">page {page + 1}</span>}>
          {tab === 'blocked' ? <Note>Hami blocks with the clause. A channel-level block (opt-out, channel not allowed for the segment, window) moves the message to the next permitted channel; a customer-level block (DNC, no consent, arrears, pause) does not. A contact-cap breach defers to the next day instead.</Note> : null}
          <div className="mt-2"><Messages rows={data?.rows ?? []} /></div>
          <div className="mt-3 flex items-center gap-2"><Btn small onClick={() => setPage((x) => Math.max(0, x - 1))} disabled={page === 0}>Previous</Btn><Btn small onClick={() => setPage((x) => x + 1)} disabled={(page + 1) * 60 >= (data?.total ?? 0)}>Next</Btn></div>
        </Panel>
      )}
    </Screen>
  );
}

function Inbound() {
  const { data } = useApi<any[]>('/comms/inbound', { poll: 12000 });
  const { openCase, open } = useApp();
  return (
    <Panel icon={<InboxIcon size={16} />} title="Inbound: app replies, uploads and e-mail">
      <ul className="space-y-2">{(data ?? []).map((i) => (
        <li key={i.id} className="rounded-lg border border-border/60 bg-card/50 p-2.5 text-[12px]">
          <p className="flex flex-wrap items-center gap-2 text-muted-foreground"><span className="font-mono">{dateTime(i.received_at)}</span><Chip>{i.channel}</Chip>{i.customer_id ? <button type="button" className="font-mono text-primary" onClick={() => open(`customer:${i.customer_id}`)}>{i.customer_id}</button> : <Chip tone="warn">unmatched</Chip>}{i.name_en ? <span>{i.name_en}</span> : null}{i.case_ref ? <button type="button" className="font-mono text-primary" onClick={() => openCase(i.case_ref)}>{i.case_ref}</button> : null}<span className="ms-auto flex items-center gap-1">{i.classification ? <StatusChip status={i.classification} /> : null}{i.confidence ? <span className="font-mono">{Number(i.confidence).toFixed(2)}</span> : null}{i.mode ? <StatusChip status={i.mode} /> : null}</span></p>
          {i.subject ? <p className="mt-1 font-medium">{i.subject}</p> : null}<p className="mt-0.5">{i.body}</p>
          {(i.attachments ?? []).length ? <p className="mt-0.5 flex items-center gap-1 text-muted-foreground"><Paperclip className="h-3 w-3" />{i.attachments.map((a: any) => a.name).join(', ')}</p> : null}
          {i.routed_to ? <p className="mt-0.5 text-muted-foreground">Mustaqbil → {i.routed_to}{i.matched_by ? ` · matched by ${i.matched_by}` : ''}</p> : null}
        </li>))}</ul>
      {!data?.length ? <Empty>No inbound messages yet.</Empty> : null}
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
    <Panel icon={<FileText size={16} />} title="Approved templates (one body per reason × type × language; push and SMS renderings are derived)" action={<div className="flex gap-2"><Select value={type} onChange={setType}>{types.map((t) => <option key={t} value={t}>{title(t)}</option>)}</Select><Select value={lang} onChange={(v) => setLang(v as any)}><option value="en">English</option><option value="ar">Arabic</option></Select></div>}>
      <div className="grid gap-3 md:grid-cols-2">{rows.map((t) => <div key={t.key} className={`rounded-xl border border-border/60 bg-card/50 p-3 text-[12px] ${lang === 'ar' ? 'ar text-end' : ''}`} dir={lang === 'ar' ? 'rtl' : 'ltr'}><p className="flex items-center gap-2 font-mono text-[10px] text-muted-foreground"><span className="ltr">{t.key}</span>{t.marketing ? <Chip tone="warn">offer · consent needed</Chip> : <Chip>service</Chip>}</p><p className="mt-1 font-semibold">{t.subject}</p><p className="mt-1 whitespace-pre-wrap leading-relaxed">{t.body}</p></div>)}</div>
      <p className="mt-2 text-[11px] text-muted-foreground">Every customer-facing body carries the CRA art. 6(4) elements: sender identity, purpose, opt-out instruction and the reference [POL-07 §4.1]. Placeholders in braces are filled per customer at send time.</p>
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
      <div className="flex flex-wrap items-center gap-2"><input className="input" placeholder="Customer DEMO id" value={pick} onChange={(e) => setPick(e.target.value.toUpperCase())} /><Btn small onClick={() => onPick(pick)}>Open mailbox</Btn>{data ? <span className="text-[12px] text-muted-foreground">{data.customer.nameEn} · {data.customer.email}{data.caseRef ? <> · open case <Ref>{data.caseRef}</Ref></> : null}</span> : null}</div>
      {error ? <Empty>{error}</Empty> : null}
      {data ? (
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
          <Panel icon={<Mail size={16} />} title="Inbox (simulated)">
            <div className="divide-y divide-border/40 rounded-lg border border-border/60">{mails.map((x: any) => <div key={x.id} className={`mail-row ${m?.id === x.id ? 'bg-primary/5' : ''}`} onClick={() => setSel(x.id)}><div className="min-w-0"><p className="truncate text-[13px] font-medium">{x.subject}</p><p className="truncate text-[12px] text-muted-foreground">{x.kind === 'OUTGOING' ? 'You → QIB' : 'QIB · Jahiz'} · {String(x.body).replace(/\s+/g, ' ').slice(0, 80)}</p></div><span className="font-mono text-[11px] text-muted-foreground">{dateTime(x.at)}</span></div>)}{!mails.length ? <p className="p-3 text-[12px] text-muted-foreground">No e-mail yet for this customer.</p> : null}</div>
          </Panel>
          <div className="space-y-3">
            {m ? <Panel title={m.subject ?? '(no subject)'} action={<Chip>{m.kind === 'OUTGOING' ? 'sent by the customer' : m.lang === 'ar' ? 'Arabic' : 'English'}</Chip>}><p className="text-[12px] text-muted-foreground">{m.kind === 'OUTGOING' ? `To: oneclick@qib.demo` : `From: Qatar Islamic Bank <noreply@qib.demo>`} · {dateTime(m.at)}</p><div className={`mt-2 whitespace-pre-wrap text-[13px] leading-relaxed ${m.lang === 'ar' ? 'ar text-end' : ''}`} dir={m.lang === 'ar' ? 'rtl' : 'ltr'}>{m.body}</div></Panel> : null}
            <Panel icon={<Paperclip size={16} />} title="Reply as the customer">
              <div className="space-y-2"><input className="input w-full" placeholder="Subject" value={subject} onChange={(e) => setSubject(e.target.value)} /><textarea className="input w-full" placeholder="Message (try 'Please find my renewed ID attached', 'I lost my job last month', 'STOP', or a question)" value={body} onChange={(e) => setBody(e.target.value)} />
                <div className="flex flex-wrap items-center gap-2"><Select value={specimen} onChange={setSpecimen}><option value="">No attachment</option>{(data.specimens ?? []).map((s: any) => <option key={s.kind} value={s.kind}>{s.label}{s.flaw ? ' ⚠' : ''}</option>)}</Select>
                  <Btn kind="primary" small disabled={busy || (!body && !specimen)} onClick={async () => { setBusy(true); setMsg(''); try { const r = await post(`/customer/${customerId}/email`, { subject, body: body || 'Please see attached.', specimen: specimen || undefined }); setMsg(`Received: ${r.documentIds.length} attachment(s) → WF-06 run ${r.runId}. Mustaqbil classifies, Fahis examines, the checker decides.`); setBody(''); setSpecimen(''); bump(); reload(); } catch (e: any) { setMsg(e.message); } finally { setBusy(false); } }}>{busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}Send to QIB</Btn></div>
                {msg ? <p className="text-[12px] text-muted-foreground">{msg}</p> : null}
                <p className="text-[11px] text-muted-foreground">In production this inbox is the Microsoft Graph poll on a shared mailbox (stubbed in v1); the reply enters the same pipeline, matched by the case reference in the subject or by the sender address. An e-mailed document gets the lowest assurance level and always needs the checker [POL-02 §2.1].</p>
              </div>
            </Panel>
          </div>
        </div>
      ) : <Empty>Pick a customer to open their mailbox.</Empty>}
    </div>
  );
}
