/**
 * Customer app — "QIB Mobile (demo)": the customer's phone inside the
 * platform. Push notifications and in-app messages Jahiz sent, the document
 * upload (a specimen, or a real image that Fahis reads with Claude), the One
 * Click offer card, and a reply box. Everything the customer does here enters
 * the inbound pipeline exactly as a real app event would.
 */
import { useEffect, useRef, useState } from 'react';
import { Panel, PageColumns } from '@cognirise/atelier/layout';
import { Bell, CheckCircle2, Loader2, Paperclip, Send, Smartphone, Upload, Wallet } from 'lucide-react';
import { bump, post, useApi } from '../lib/api';
import { date, dateTime, qar, rel, title } from '../lib/format';
import { useApp } from '../app/state';
import { Btn, Chip, Empty, Hero, Note, Ref, Screen, Select, StatusChip } from '../app/ui';

const ASK: Record<string, string> = { R07: 'Upload your renewed Qatar ID (front and back)', R06: 'Upload the data page of your renewed passport', R01: 'Upload a recent salary certificate or an HR letter', R02: 'Upload a salary certificate naming your employer', R04: 'Tell us what each standing order is for', R08: 'Open a current account', R13: 'Confirm your details to reactivate your account' };
const ASK_AR: Record<string, string> = { R07: 'حمّل بطاقتك الشخصية القطرية المجددة (الوجه والظهر)', R06: 'حمّل صفحة البيانات من جواز سفرك المجدد', R01: 'حمّل شهادة راتب حديثة أو رسالة من الموارد البشرية', R02: 'حمّل شهادة راتب تذكر اسم جهة عملك', R04: 'أخبرنا بالغرض من كل أمر دفع مستديم', R08: 'افتح حساباً جارياً', R13: 'أكّد بياناتك لإعادة تفعيل حسابك' };
const DEFAULT_SPECIMEN: Record<string, string> = { R07: 'qid-new', R06: 'passport-new', R01: 'hr-letter', R02: 'salary-cert', R04: 'so-declaration', R13: 'qid-new' };

export function CustomerAppScreen() {
  const { route, go, session } = useApp();
  const [id, setId] = useState(route.param ?? session?.edge?.EC02 ?? 'DEMO-C-00002');
  useEffect(() => { if (route.param) setId(route.param); }, [route.param]);
  const [pick, setPick] = useState(id);
  const edge = session?.edge ?? {};
  return (
    <Screen hero={<Hero eyebrow="Customer app · QIB Mobile (demo)" title="The customer's phone, inside the platform" lede="The channel that will work in Qatar: the customer is reached where they already are, asked for exactly one thing, with one tap to upload. Pick any customer; what they see is what Jahiz actually delivered through the simulated adapters. Everything they do here — upload, reply, accept — enters the inbound pipeline exactly as a real app event would." />} banner={false}>
      <div className="flex flex-wrap items-center gap-2"><input className="input" placeholder="Customer DEMO id" value={pick} onChange={(e) => setPick(e.target.value.toUpperCase())} /><Btn small kind="primary" onClick={() => go('customer-app', pick)}>Open the phone</Btn><span className="text-[12px] text-muted-foreground">Edge cases:</span>{['EC02', 'EC03', 'EC09', 'EC13', 'EC17', 'EC01', 'EC07', 'EC08'].filter((k) => edge[k]).map((k) => <button key={k} type="button" className="mono-chip hover:opacity-80" onClick={() => { setPick(edge[k]); go('customer-app', edge[k]); }}>{k}</button>)}</div>
      <Phone id={id} />
    </Screen>
  );
}

export function Phone({ id }: { id: string }) {
  const { data: d, error, reload } = useApi<any>(`/customer/${id}/phone`, { poll: 8000 });
  const { openCase, go } = useApp();
  const [tab, setTab] = useState<'home' | 'messages' | 'upload'>('home');
  const [specimen, setSpecimen] = useState(''); const [busy, setBusy] = useState(false); const [msg, setMsg] = useState(''); const [reply, setReply] = useState(''); const [assurance, setAssurance] = useState<'APP_UPLOAD' | 'RM_SCAN'>('APP_UPLOAD');
  const [so, setSo] = useState<Record<number, string>>({});
  const file = useRef<HTMLInputElement>(null);
  useEffect(() => { setSpecimen(''); setMsg(''); setTab('home'); setSo({}); }, [id]);
  if (error) return <Empty>{error}</Empty>;
  if (!d) return <p className="p-6 text-sm text-muted-foreground">Loading…</p>;
  const c = d.customer; const ar = c.lang === 'ar';
  const kase = d.case; const primary = kase?.primary_reason;
  const unread = d.inbox.filter((m: any) => m.kind !== 'OUTGOING').length;
  const upload = async (body: any) => { setBusy(true); setMsg(''); try { const r = await post(`/customer/${id}/upload`, body); setMsg(`Received. Mustaqbil matched it to ${r.caseId ? `case ${r.caseId}` : 'the customer'} and Fahis is examining document ${r.documentIds.join(', ')}. The checker decides next.`); bump(); reload(); setTab('messages'); } catch (e: any) { setMsg(e.message); } finally { setBusy(false); } };
  const onFile = async (f: File) => { if (!f) return; const data = await new Promise<string>((res) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1]); r.readAsDataURL(f); }); const type = primary === 'R06' ? 'PASSPORT' : primary === 'R01' ? 'SALARY_CERT' : primary === 'R02' ? 'SALARY_CERT' : 'QID'; await upload({ image: { data, mime: f.type || 'image/jpeg', name: f.name, type }, assurance }); };
  return (
    <PageColumns aside={<>
      <Panel icon={<Smartphone size={16} />} title="This customer">
        <p className="text-sm font-medium">{c.nameEn} <span className="ar text-muted-foreground">{c.nameAr}</span></p>
        <p className="flex flex-wrap items-center gap-1 text-[12px] text-muted-foreground"><Ref>{c.id}</Ref><Chip>{title(c.segment)}</Chip>{c.app ? <Chip tone="success">app registered</Chip> : <Chip tone="warn">no app — e-mail and SMS only</Chip>}{c.marketing ? <Chip>marketing consent</Chip> : <Chip tone="warn">no marketing consent</Chip>}{c.dnc ? <Chip tone="danger">do-not-contact</Chip> : null}</p>
        <dl className="mt-2 grid grid-cols-2 gap-2 text-[12px]"><div><dt className="text-muted-foreground">QID expires</dt><dd>{date(c.qidExpiry)}</dd></div>{!c.isQatari ? <div><dt className="text-muted-foreground">Passport expires</dt><dd>{date(c.passportExpiry)}</dd></div> : null}<div><dt className="text-muted-foreground">Current account</dt><dd>{c.hasCurrentAccount ? 'yes' : 'no'}</dd></div><div><dt className="text-muted-foreground">Last check</dt><dd>{d.eligibility ? (d.eligibility.eligible ? `eligible ${qar(d.eligibility.amount)}` : `not eligible: ${d.eligibility.reason_codes.join(', ')}`) : '—'}</dd></div></dl>
        {kase ? <p className="mt-2 text-[12px]">Open case <button type="button" className="font-mono text-primary" onClick={() => openCase(kase.ref)}>{kase.ref}</button> · <StatusChip status={kase.state} /> · {kase.attempts}/{kase.max_attempts} notices</p> : <p className="mt-2 text-[12px] text-muted-foreground">No open case.</p>}
        <p className="mt-2 flex flex-wrap gap-2 text-[12px]"><button type="button" className="text-primary" onClick={() => go('customers', c.id)}>Customer 360</button><button type="button" className="text-primary" onClick={() => go('comms', `mailbox=${c.id}`)}>Mailbox</button><button type="button" className="text-primary" onClick={() => go('comms', `customer=${c.id}`)}>All messages</button></p>
      </Panel>
      <Panel icon={<Upload size={16} />} title="What happens when the customer uploads">
        <ol className="list-decimal space-y-1 ps-4 text-[12px]"><li>The upload is an app event: <span className="font-mono">POST /api/customer/{'{id}'}/upload</span>, assurance "app upload" (an RM-collected scan is "RM scan"; e-mail is lowest).</li><li>Mustaqbil matches it to the open case and classifies it (document).</li><li>Fahis extracts the fields — with Claude (vision for a real image, text for a specimen) or Offline from the specimen's data — verifies number, name, expiry, MRZ, and proposes the update with its confidence.</li><li>The checker approves or rejects in the Inbox; Muhaddith writes; Muahil re-qualifies; the One Click offer lands here.</li></ol>
        {msg ? <Note>{msg}</Note> : null}
      </Panel>
    </>}>
      <div className="flex justify-center">
        <div className="phone" dir={ar ? 'rtl' : 'ltr'}>
          <div className="phone-notch" />
          <div className="phone-top">
            <div className="flex items-center gap-2"><img src="/brand/mark-on-dark.png" alt="" className="h-6 w-6" /><span className="text-[13px] font-semibold tracking-wide">QIB Mobile <span className="font-normal opacity-70">(demo)</span></span><span className="ms-auto flex items-center gap-1 text-[11px] opacity-80"><Bell className="h-3.5 w-3.5" />{unread}</span></div>
            <p className={`mt-3 text-[15px] font-semibold ${ar ? 'ar' : ''}`}>{ar ? `أهلاً ${c.nameAr.split(' ')[0]}` : `Hello ${c.nameEn.split(' ')[0]}`}</p>
            <p className="text-[11px] opacity-80">{ar ? 'الحساب الجاري' : 'Current account'} · {c.hasCurrentAccount ? '•••• ' + c.id.slice(-4) : (ar ? 'لا يوجد' : 'none')}</p>
          </div>
          <div className="flex border-b border-black/10 text-[12px] dark:border-white/10">{(['home', 'messages', 'upload'] as const).map((t) => <button key={t} type="button" onClick={() => setTab(t)} className={`flex-1 py-2 ${tab === t ? 'border-b-2 border-[#0075B0] font-semibold text-[#0075B0]' : 'text-muted-foreground'}`}>{t === 'home' ? (ar ? 'الرئيسية' : 'Home') : t === 'messages' ? (ar ? 'الرسائل' : 'Messages') : (ar ? 'المستندات' : 'Documents')}</button>)}</div>
          <div className="space-y-3 p-3 text-[13px]" style={{ minHeight: 480 }}>
            {tab === 'home' ? (
              <>
                {d.offer ? (
                  <div className="rounded-2xl bg-gradient-to-br from-[#002E5E] to-[#0075B0] p-4 text-white shadow">
                    <p className="flex items-center gap-1 text-[11px] uppercase tracking-wider opacity-80"><Wallet className="h-3.5 w-3.5" /> One Click Finance</p>
                    <p className={`mt-1 text-[15px] font-semibold ${ar ? 'ar' : ''}`}>{d.offer.subject}</p>
                    <p className={`mt-1 text-[12px] opacity-90 ${ar ? 'ar' : ''}`}>{String(d.offer.body).split('\n\n')[1]?.slice(0, 200)}</p>
                    {d.inbox.some((m: any) => m.meta?.accepted) ? <p className="mt-3 flex items-center gap-1 text-[12px]"><CheckCircle2 className="h-4 w-4" /> {ar ? 'تم قبول العرض' : 'Offer accepted'}</p> : <button type="button" disabled={busy} className="mt-3 w-full rounded-full bg-[#DF7A00] py-2 text-[13px] font-semibold" onClick={async () => { setBusy(true); try { await post(`/customer/${id}/accept-offer`); bump(); reload(); } finally { setBusy(false); } }}>{ar ? 'اقبل بنقرة واحدة' : 'Accept in one tap'}</button>}
                  </div>
                ) : null}
                {kase && !kase.paused && kase.state !== 'CLOSED' && ASK[primary] ? (
                  <div className="rounded-2xl border border-[#DF7A00]/50 bg-white p-3 shadow-sm dark:bg-card">
                    <p className="text-[11px] uppercase tracking-wider text-[#DF7A00]">{ar ? 'مطلوب منك' : 'Action needed'}</p>
                    <p className={`mt-1 font-semibold ${ar ? 'ar' : ''}`}>{ar ? ASK_AR[primary] ?? ASK[primary] : ASK[primary]}</p>
                    <p className="mt-1 text-[11px] text-muted-foreground">{ar ? 'المرجع' : 'Reference'} {kase.ref}</p>
                    {primary === 'R04' ? (
                      <div className="mt-2 space-y-1.5">{d.standingOrders.map((s: any, i: number) => <div key={s.id} className="flex items-center gap-2 text-[12px]"><span className="min-w-0 flex-1 truncate">{s.beneficiary_name} · {qar(s.amount)}</span><Select className="h-8 text-[12px]" value={so[s.id] ?? ''} onChange={(v) => setSo({ ...so, [s.id]: v })}><option value="">…</option><option value="SCHOOL">School fees</option><option value="FAMILY">Family</option><option value="RENT">Rent</option><option value="FI">Other-bank finance</option><option value="OTHER">Other</option></Select></div>)}<button type="button" disabled={busy || Object.keys(so).length < d.standingOrders.length} className="mt-1 w-full rounded-full bg-[#0075B0] py-2 text-[13px] font-semibold text-white disabled:opacity-50" onClick={() => upload({ specimen: 'so-declaration', text: `Standing orders: ${d.standingOrders.map((s: any, i: number) => `order ${i + 1} = ${so[s.id]}`).join(', ')}` })}>{ar ? 'إرسال الإقرار' : 'Send the declaration'}</button></div>
                    ) : primary === 'R08' ? (
                      <button type="button" disabled={busy} className="mt-2 w-full rounded-full bg-[#0075B0] py-2 text-[13px] font-semibold text-white" onClick={async () => { setBusy(true); try { await post(`/customer/${id}/reply`, { text: 'Yes please, I accept — open the current account.' }); bump(); reload(); setMsg('Acceptance received: the checker approves the (simulated) opening, then Muahil re-qualifies.'); } finally { setBusy(false); } }}>{ar ? 'افتح حساباً جارياً' : 'Open a current account'}</button>
                    ) : (
                      <button type="button" className="mt-2 w-full rounded-full bg-[#0075B0] py-2 text-[13px] font-semibold text-white" onClick={() => { setTab('upload'); setSpecimen(DEFAULT_SPECIMEN[primary] ?? 'qid-new'); }}>{ar ? 'تحميل المستند' : 'Upload'}</button>
                    )}
                  </div>
                ) : kase?.paused ? <div className="rounded-2xl bg-white p-3 text-[12px] shadow-sm dark:bg-card">{ar ? 'سيتواصل معك أحد ممثلي المصرف.' : 'A QIB representative will contact you.'}</div> : <div className="rounded-2xl bg-white p-3 text-[12px] text-muted-foreground shadow-sm dark:bg-card">{ar ? 'لا إجراء مطلوب.' : 'Nothing is needed from you right now.'}</div>}
                <div className="rounded-2xl bg-white p-3 shadow-sm dark:bg-card"><p className="text-[11px] uppercase tracking-wider text-muted-foreground">{ar ? 'آخر الرسائل' : 'Recent'}</p>{d.inbox.slice(0, 3).map((m: any) => <p key={m.id} className={`mt-1 truncate text-[12px] ${ar ? 'ar' : ''}`}><Chip>{m.kind}</Chip> {m.subject ?? m.body}</p>)}</div>
              </>
            ) : tab === 'messages' ? (
              <div className="space-y-2">{[...d.inbox].reverse().map((m: any) => <div key={m.id} className={`flex ${m.kind === 'OUTGOING' ? 'justify-end' : 'justify-start'}`}><div className={`phone-bubble max-w-[85%] ${ar ? 'ar' : ''} ${m.kind === 'OUTGOING' ? 'bg-[#0075B0] text-white' : m.kind === 'PUSH' ? 'border border-[#DF7A00]/40 bg-[#fff7ee] dark:bg-[#2a1f12]' : 'bg-white shadow-sm dark:bg-card'}`}><p className="text-[10px] uppercase tracking-wider opacity-60">{m.kind === 'OUTGOING' ? (ar ? 'أنت' : 'You') : m.kind} · {rel(m.at, d.now)}</p>{m.subject && m.kind !== 'PUSH' ? <p className="font-semibold">{m.subject}</p> : null}<p className="whitespace-pre-wrap">{m.kind === 'INAPP' || m.kind === 'EMAIL' ? String(m.body).split('\n\n').slice(0, 2).join('\n\n') : m.body}</p>{m.meta?.attachments?.length ? <p className="mt-1 flex items-center gap-1 text-[11px] opacity-80"><Paperclip className="h-3 w-3" />{m.meta.attachments.join(', ')}</p> : null}</div></div>)}{!d.inbox.length ? <p className="text-center text-[12px] text-muted-foreground">No messages yet.</p> : null}
                <div className="flex items-center gap-1 pt-2"><input className="input h-9 flex-1 text-[12px]" placeholder={ar ? 'اكتب رداً… (جرّب "إيقاف")' : 'Reply… (try "STOP", a question, or "I lost my job")'} value={reply} onChange={(e) => setReply(e.target.value)} /><button type="button" disabled={busy || !reply.trim()} className="rounded-full bg-[#0075B0] p-2 text-white disabled:opacity-50" onClick={async () => { setBusy(true); try { await post(`/customer/${id}/reply`, { text: reply }); setReply(''); bump(); reload(); } finally { setBusy(false); } }}><Send className="h-4 w-4" /></button></div>
              </div>
            ) : (
              <div className="space-y-2">
                <p className={`font-semibold ${ar ? 'ar' : ''}`}>{ar ? 'تحميل مستند' : 'Upload a document'}</p>
                <p className="text-[11px] text-muted-foreground">Pick a specimen (rendered from this customer's synthetic record, four are deliberately wrong) or a real photo from your computer, which Fahis reads with Claude.</p>
                <Select className="w-full text-[12px]" value={specimen} onChange={setSpecimen}><option value="">Choose a specimen…</option>{d.specimens.map((s: any) => <option key={s.kind} value={s.kind}>{s.label}{s.flaw ? ' ⚠' : ''}</option>)}</Select>
                <div className="flex items-center gap-2 text-[11px]"><label className="flex items-center gap-1"><input type="radio" checked={assurance === 'APP_UPLOAD'} onChange={() => setAssurance('APP_UPLOAD')} /> app upload</label><label className="flex items-center gap-1"><input type="radio" checked={assurance === 'RM_SCAN'} onChange={() => setAssurance('RM_SCAN')} /> RM-collected scan</label></div>
                <button type="button" disabled={busy || !specimen} className="w-full rounded-full bg-[#0075B0] py-2 text-[13px] font-semibold text-white disabled:opacity-50" onClick={() => upload({ specimen, assurance })}>{busy ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : (ar ? 'إرسال' : 'Upload the specimen')}</button>
                <input ref={file} type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
                <button type="button" disabled={busy} className="w-full rounded-full border border-[#0075B0] py-2 text-[13px] font-semibold text-[#0075B0]" onClick={() => file.current?.click()}>{ar ? 'التقط صورة حقيقية' : 'Upload a real photo instead'}</button>
                {msg ? <p className="text-[11px] text-muted-foreground">{msg}</p> : null}
              </div>
            )}
          </div>
          <p className="px-3 pb-3 text-center text-[9px] uppercase tracking-wider text-muted-foreground">Synthetic · specimen documents · demo</p>
        </div>
      </div>
      <p className="text-center text-[11px] text-muted-foreground">Last delivery {d.inbox[0] ? dateTime(d.inbox[0].at) : '—'} · {d.inbox.length} items on this phone</p>
    </PageColumns>
  );
}
