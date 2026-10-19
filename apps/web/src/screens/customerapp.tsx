/**
 * QIB Mobile customer demo. Customer actions below remain connected to the
 * same inbound demo API; only the presentation is modeled on the QIB app.
 */
import { useEffect, useRef, useState } from 'react';
import { Panel, PageColumns } from '@cognirise/atelier/layout';
import { Bell, Check, CheckCircle2, ChevronRight, CircleUserRound, FileText, Home, Loader2, MessageCircle, Paperclip, Send, Smartphone, Sparkles, Upload, Wallet } from 'lucide-react';
import { bump, post, useApi } from '../lib/api';
import { date, dateTime, qar, rel, title } from '../lib/format';
import { useApp } from '../app/state';
import { Btn, Chip, Empty, Hero, Note, Ref, Screen, Select, StatusChip } from '../app/ui';
import './customerapp-phone.css';

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
    <Screen hero={<Hero eyebrow="Customer app · QIB Mobile (demo)" title="The customer's phone, inside the platform" lede="A familiar QIB-style customer screen for the finance offers and remedial requests Jahiz actually delivered. Uploads and replies enter the live demo inbound pipeline." />} banner={false}>
      <div className="flex flex-wrap items-center gap-2"><input className="input" aria-label="Customer demo ID" placeholder="Customer DEMO id" value={pick} onChange={(e) => setPick(e.target.value.toUpperCase())} /><Btn small kind="primary" onClick={() => go('customer-app', pick)}>Open the phone</Btn><span className="text-[12px] text-muted-foreground">Edge cases:</span>{['EC02', 'EC03', 'EC09', 'EC13', 'EC17', 'EC01', 'EC07', 'EC08'].filter((k) => edge[k]).map((k) => <button key={k} type="button" className="mono-chip hover:opacity-80" onClick={() => { setPick(edge[k]); go('customer-app', edge[k]); }}>{k}</button>)}</div>
      <Phone id={id} key={id} />
    </Screen>
  );
}

/** The customer's phone. `bare` renders the phone alone (the Stage docks it in its own pane); otherwise the explanatory panels sit beside it. */
export function Phone({ id, bare }: { id: string; bare?: boolean }) {
  const { data: d, error, reload } = useApi<any>(`/customer/${id}/phone`, { poll: 8000 });
  const { openCase, go } = useApp();
  const [tab, setTab] = useState<'home' | 'messages' | 'upload'>('home');
  const [specimen, setSpecimen] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [reply, setReply] = useState('');
  const [assurance, setAssurance] = useState<'APP_UPLOAD' | 'RM_SCAN'>('APP_UPLOAD');
  const [so, setSo] = useState<Record<number, string>>({});
  const file = useRef<HTMLInputElement>(null);
  const finance = useRef<HTMLDivElement>(null);
  useEffect(() => { setSpecimen(''); setMsg(''); setReply(''); setTab('home'); setSo({}); }, [id]);
  if (error) return <div className="customer-phone-state"><Empty>{error}</Empty><button type="button" className="customer-retry" onClick={() => reload()}>Try again</button></div>;
  if (!d) return <div className="customer-phone-state"><div className="customer-skeleton" /><div className="customer-skeleton short" /><div className="customer-skeleton" /><span>Loading customer phone…</span></div>;
  const c = d.customer;
  const ar = c.lang === 'ar';
  const kase = d.case;
  const primary = kase?.primary_reason;
  const unread = d.inbox.filter((m: any) => m.kind !== 'OUTGOING').length;
  const accepted = d.inbox.some((m: any) => m.meta?.accepted);
  const goTab = (next: typeof tab) => setTab(next);
  const goFinance = () => {
    setTab('home');
    requestAnimationFrame(() => finance.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }));
  };
  const submit = async (path: string, body: any, success?: string) => {
    setBusy(true); setMsg('');
    try { await post(path, body); if (success) setMsg(success); bump(); reload(); return true; }
    catch (e: any) { setMsg(e?.message || 'That action could not be completed. Please try again.'); return false; }
    finally { setBusy(false); }
  };
  const upload = async (body: any) => {
    setBusy(true); setMsg('');
    try {
      const r = await post(`/customer/${id}/upload`, body);
      setMsg(`Received. Mustaqbil matched it to ${r.caseId ? `case ${r.caseId}` : 'the customer'} and Fahis is examining document ${r.documentIds.join(', ')}. The checker decides next.`);
      bump(); reload(); setTab('messages');
    } catch (e: any) { setMsg(e?.message || 'Upload failed. Please try again.'); }
    finally { setBusy(false); }
  };
  const onFile = async (f: File) => {
    if (!f) return;
    try {
      const data = await new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1]); r.onerror = () => rej(new Error('The selected image could not be read.')); r.readAsDataURL(f); });
      const type = primary === 'R06' ? 'PASSPORT' : primary === 'R01' || primary === 'R02' ? 'SALARY_CERT' : 'QID';
      await upload({ image: { data, mime: f.type || 'image/jpeg', name: f.name, type }, assurance });
    } catch (e: any) { setMsg(e?.message || 'The selected image could not be read.'); }
  };
  const submitReply = async () => {
    if (!reply.trim()) return;
    if (await submit(`/customer/${id}/reply`, { text: reply })) setReply('');
  };

  const phone = (
    <div className="customer-phone-wrap">
        <div className="customer-phone" dir={ar ? 'rtl' : 'ltr'}>
          <div className="customer-status"><span>9:41</span><span className="customer-status-icons">● &nbsp; ▮▮▮</span></div>
          <header className="customer-header">
            <div className="customer-header-row">
              <img src="/brand/logo-on-dark.png" alt="Qatar Islamic Bank" className="customer-logo" />
              <span className="customer-demo-tag">DEMO</span>
              <span className="customer-avatar" title={c.nameEn}><CircleUserRound size={19} /></span>
              <button type="button" className="customer-bell" aria-label={`${unread} unread messages`} onClick={() => goTab('messages')}><Bell size={19} />{unread > 0 && <i />}</button>
            </div>
          </header>
          <main className="customer-main">
            <div className="customer-greeting">
              <div><span className="customer-kicker">{ar ? 'مرحباً بعودتك' : 'WELCOME BACK'}</span><h2 className={ar ? 'ar' : ''}>{ar ? `أهلاً ${c.nameAr.split(' ')[0]}` : `Hello, ${c.nameEn.split(' ')[0]}`}</h2></div>
              <span className="customer-greeting-mark"><Sparkles size={17} /></span>
            </div>
            {tab === 'home' ? (
              <>
                <section className="customer-shortcuts" aria-label={ar ? 'اختصارات' : 'Shortcuts'}>
                  <button type="button" onClick={() => goTab('home')}><span><Home size={20} /></span><b>{ar ? 'الرئيسية' : 'Home'}</b></button>
                  <button type="button" onClick={() => goTab('messages')}><span><MessageCircle size={20} /></span><b>{ar ? 'الرسائل' : 'Messages'}</b>{unread > 0 && <i>{unread}</i>}</button>
                  <button type="button" onClick={() => goTab('upload')}><span><FileText size={20} /></span><b>{ar ? 'المستندات' : 'Documents'}</b></button>
                  <button type="button" onClick={goFinance}><span><Wallet size={20} /></span><b>{ar ? 'التمويل' : 'Finance'}</b></button>
                </section>
                <div ref={finance}>
                {d.offer ? <section className="customer-card customer-offer">
                  <div className="customer-card-heading"><span className="customer-card-icon"><Wallet size={17} /></span><span>{ar ? 'تمويل بنقرة واحدة' : 'ONE CLICK FINANCE'}</span><span className="customer-card-pip" /></div>
                  <h3 className={ar ? 'ar' : ''}>{d.offer.subject}</h3>
                  <p className={ar ? 'ar' : ''}>{String(d.offer.body).split('\n\n')[1]?.slice(0, 200)}</p>
                  {accepted ? <div className="customer-complete"><CheckCircle2 size={17} />{ar ? 'تم قبول العرض' : 'Offer accepted'}</div> :
                    <button type="button" disabled={busy} className="customer-primary-button" onClick={() => submit(`/customer/${id}/accept-offer`, {}, '')}>{busy ? <Loader2 size={16} className="animate-spin" /> : <>{ar ? 'اقبل بنقرة واحدة' : 'Accept offer'} <ChevronRight size={16} /></>}</button>}
                </section> : null}
                {kase && !kase.paused && kase.state !== 'CLOSED' && ASK[primary] ? <section className="customer-card customer-action">
                  <div className="customer-card-heading"><span className="customer-card-icon"><FileText size={17} /></span><span>{ar ? 'مطلوب منك' : 'ACTION REQUIRED'}</span><span className="customer-action-badge">{ar ? 'مطلوب' : 'To do'}</span></div>
                  <h3 className={ar ? 'ar' : ''}>{ar ? ASK_AR[primary] ?? ASK[primary] : ASK[primary]}</h3>
                  <p className="customer-ref">{ar ? 'المرجع' : 'Reference'} <strong>{kase.ref}</strong></p>
                  {primary === 'R04' ? <div className="customer-orders">
                    {d.standingOrders.map((s: any, i: number) => <div key={s.id} className="customer-order"><span>{s.beneficiary_name} · {qar(s.amount)}</span><Select className="h-8 text-[12px]" value={so[s.id] ?? ''} onChange={(v) => setSo({ ...so, [s.id]: v })}><option value="">Choose purpose…</option><option value="SCHOOL">School fees</option><option value="FAMILY">Family</option><option value="RENT">Rent</option><option value="FI">Other-bank finance</option><option value="OTHER">Other</option></Select></div>)}
                    <button type="button" disabled={busy || Object.keys(so).length < d.standingOrders.length} className="customer-primary-button" onClick={() => upload({ specimen: 'so-declaration', text: `Standing orders: ${d.standingOrders.map((s: any, i: number) => `order ${i + 1} = ${so[s.id]}`).join(', ')}` })}>{ar ? 'إرسال الإقرار' : 'Send declaration'} <ChevronRight size={16} /></button>
                  </div> : primary === 'R08' ?
                    <button type="button" disabled={busy} className="customer-primary-button" onClick={() => submit(`/customer/${id}/reply`, { text: 'Yes please, I accept — open the current account.' }, 'Acceptance received: the checker approves the (simulated) opening, then Muahil re-qualifies.')}>{ar ? 'افتح حساباً جارياً' : 'Open a current account'} <ChevronRight size={16} /></button> :
                    <button type="button" className="customer-primary-button" onClick={() => { setTab('upload'); setSpecimen(DEFAULT_SPECIMEN[primary] ?? 'qid-new'); }}>{ar ? 'تحميل المستند' : 'Upload document'} <ChevronRight size={16} /></button>}
                </section> : kase?.paused ? <section className="customer-card customer-empty-card"><span className="customer-empty-icon"><MessageCircle size={19} /></span><div><h3>{ar ? 'متابعة طلبك' : 'We’re looking into it'}</h3><p>{ar ? 'سيتواصل معك أحد ممثلي المصرف.' : 'A QIB representative will contact you.'}</p></div></section> : <section className="customer-card customer-empty-card"><span className="customer-empty-icon"><Check size={19} /></span><div><h3>{ar ? 'كل شيء محدّث' : 'You’re all caught up'}</h3><p>{ar ? 'لا إجراء مطلوب.' : 'Nothing is needed from you right now.'}</p></div></section>}
                </div>
                <section className="customer-card customer-recent">
                  <div className="customer-section-title"><h3>{ar ? 'آخر المستجدات' : 'Recent activity'}</h3><button type="button" onClick={() => goTab('messages')}>{ar ? 'عرض الكل' : 'See all'} <ChevronRight size={14} /></button></div>
                  {d.inbox.slice(0, 3).map((m: any) => <button type="button" className="customer-recent-row" key={m.id} onClick={() => goTab('messages')}><span className="customer-recent-icon"><MessageCircle size={16} /></span><span className="customer-recent-copy"><b>{m.subject ?? m.kind}</b><small>{String(m.body ?? '').split('\n')[0]}</small></span><ChevronRight size={16} /></button>)}
                  {!d.inbox.length && <p className="customer-muted">{ar ? 'ستظهر رسائلك هنا.' : 'Your messages will appear here.'}</p>}
                </section>
              </>
            ) : tab === 'messages' ? (
              <section className="customer-messages">
                <div className="customer-page-heading"><h3>{ar ? 'الرسائل' : 'Messages'}</h3><p>{ar ? 'محادثاتك مع بنك قطر الإسلامي' : 'Your messages from QIB'}</p></div>
                {[...d.inbox].reverse().map((m: any) => <div key={m.id} className={`customer-message-row ${m.kind === 'OUTGOING' ? 'is-outgoing' : ''}`}><div className={`phone-bubble ${m.kind === 'OUTGOING' ? 'customer-sent' : ''} ${m.kind === 'PUSH' ? 'customer-push' : ''}`}><p className="customer-message-meta">{m.kind === 'OUTGOING' ? (ar ? 'أنت' : 'You') : m.kind} · {rel(m.at, d.now)}</p>{m.subject && m.kind !== 'PUSH' ? <strong>{m.subject}</strong> : null}<p className="whitespace-pre-wrap">{m.kind === 'INAPP' || m.kind === 'EMAIL' ? String(m.body).split('\n\n').slice(0, 2).join('\n\n') : m.body}</p>{m.meta?.attachments?.length ? <p className="customer-attachment"><Paperclip size={13} />{m.meta.attachments.join(', ')}</p> : null}</div></div>)}
                {!d.inbox.length ? <div className="customer-message-empty"><MessageCircle size={23} /><p>{ar ? 'لا توجد رسائل بعد.' : 'No messages yet.'}</p></div> : null}
                <form className="customer-reply" onSubmit={(e) => { e.preventDefault(); void submitReply(); }}><input aria-label="Reply message" placeholder={ar ? 'اكتب رداً… (جرّب "إيقاف")' : 'Write a reply…'} value={reply} onChange={(e) => setReply(e.target.value)} /><button type="submit" aria-label="Send reply" disabled={busy || !reply.trim()}>{busy ? <Loader2 size={17} className="animate-spin" /> : <Send size={17} />}</button></form>
              </section>
            ) : (
              <section className="customer-upload">
                <div className="customer-page-heading"><h3 className={ar ? 'ar' : ''}>{ar ? 'تحميل مستند' : 'Documents'}</h3><p>{ar ? 'أرسل مستنداً بأمان إلى فريقنا' : 'Send a document securely to our team.'}</p></div>
                <div className="customer-upload-intro"><span className="customer-upload-icon"><Upload size={21} /></span><p>Pick a specimen rendered from this customer's synthetic record, or upload a real photo for Fahis to examine.</p></div>
                <label className="customer-field-label"><span>Demo specimen</span>
                  <Select className="customer-select" value={specimen} onChange={setSpecimen}><option value="">Choose a specimen…</option>{d.specimens.map((s: any) => <option key={s.kind} value={s.kind}>{s.label}{s.flaw ? ' (deliberate mismatch)' : ''}</option>)}</Select>
                </label>
                <fieldset className="customer-assurance"><legend>Upload source</legend><label><input type="radio" checked={assurance === 'APP_UPLOAD'} onChange={() => setAssurance('APP_UPLOAD')} /> App upload</label><label><input type="radio" checked={assurance === 'RM_SCAN'} onChange={() => setAssurance('RM_SCAN')} /> RM-collected scan</label></fieldset>
                <button type="button" disabled={busy || !specimen} className="customer-primary-button" onClick={() => upload({ specimen, assurance })}>{busy ? <Loader2 size={16} className="animate-spin" /> : <>{ar ? 'إرسال' : 'Upload specimen'} <ChevronRight size={16} /></>}</button>
                <div className="customer-upload-divider"><span>or</span></div>
                <input ref={file} type="file" accept="image/*" className="hidden" onChange={(e) => { const chosen = e.target.files?.[0]; if (chosen) void onFile(chosen); e.currentTarget.value = ''; }} />
                <button type="button" disabled={busy} className="customer-secondary-button" onClick={() => file.current?.click()}><Upload size={16} />{ar ? 'التقط صورة حقيقية' : 'Choose a real photo'}</button>
                <p className="customer-upload-note">Synthetic demo · Real uploads are sent as APP_UPLOAD or RM_SCAN.</p>
              </section>
            )}
            {msg && <div className="customer-feedback" role="status">{msg}</div>}
            <div className="customer-synthetic-label">Synthetic demo · secure customer view</div>
          </main>
          <nav className="customer-bottom-nav" aria-label="Customer app navigation">
            <button type="button" className={tab === 'home' ? 'selected' : ''} onClick={() => goTab('home')}><Home size={19} /><span>{ar ? 'الرئيسية' : 'Home'}</span></button>
            <button type="button" className={tab === 'messages' ? 'selected' : ''} onClick={() => goTab('messages')}><MessageCircle size={19} /><span>{ar ? 'الرسائل' : 'Messages'}</span>{unread > 0 && <i />}</button>
            <button type="button" className="customer-center-nav" aria-label={ar ? 'التمويل' : 'Finance'} onClick={goFinance}><span><Sparkles size={21} /></span></button>
            <button type="button" className={tab === 'upload' ? 'selected' : ''} onClick={() => goTab('upload')}><FileText size={19} /><span>{ar ? 'المستندات' : 'Documents'}</span></button>
            <button type="button" onClick={() => goTab('messages')}><CircleUserRound size={19} /><span>{ar ? 'المساعدة' : 'Support'}</span></button>
          </nav>
          <footer className="customer-home-indicator"><span /></footer>
        </div>
        <p className="customer-delivery-caption">Last delivery {d.inbox[0] ? dateTime(d.inbox[0].at) : '—'} · {d.inbox.length} items on this phone</p>
      </div>
  );
  if (bare) return phone;
  return <PageColumns aside={<>
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
    </>}>{phone}</PageColumns>;
}
