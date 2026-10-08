/**
 * Approved bilingual templates (DESIGN §10 `templates`). One body per reason ×
 * message type × language; the channel renderings (push one line, SMS ≤ 160
 * characters, e-mail and in-app in full) are derived from the body, never
 * authored separately. Every customer-facing body carries the CRA art. 6(4)
 * elements: sender identity, purpose, opt-out instruction, reference.
 */
import type { Channel, ReasonCode } from './types.js';

export type MessageType = 'REQUEST' | 'REMINDER' | 'FINAL_NOTICE' | 'PRE_EXPIRY' | 'RM_BRIEF' | 'ARREARS_1' | 'ARREARS_4' | 'ARREARS_7' | 'ARREARS_10' | 'OFFER' | 'SALARY_TRANSFER_OFFER' | 'CURRENT_ACCOUNT_OFFER' | 'ACK_HARDSHIP' | 'ACK_COMPLAINT' | 'OPTOUT_CONFIRM' | 'DOC_REJECTED' | 'REQUALIFIED_INFO' | 'EMPLOYER_INFO';
export type Lang = 'en' | 'ar';
export type Template = { key: string; reason: ReasonCode | null; type: MessageType; lang: Lang; subject: string; body: string; marketing: boolean };
export type Vars = Record<string, string | number | undefined>;

const EN = {
  R07: { what: 'your Qatar ID has expired on {expiry}', ask: 'Please upload the front and back of your renewed Qatar ID in the QIB Mobile app, or reply to this message with the images.', why: 'so that your account services and your One Click Finance pre-approval continue without interruption' },
  R06: { what: 'your passport on our records expired on {expiry}', ask: 'Please upload the data page of your renewed passport in the QIB Mobile app, or reply with the image.', why: 'so that your account services and your One Click Finance pre-approval continue without interruption' },
  R01: { what: 'we have not seen your salary credit for {months}', ask: 'Please upload a salary certificate dated within the last 30 days, or a letter from your employer explaining the gap, in the QIB Mobile app.', why: 'so that we can keep your finance pre-approval up to date' },
  R02: { what: 'your employer is not recorded on your profile', ask: 'Please upload a recent salary certificate naming your employer in the QIB Mobile app, or reply with your employer\'s name.', why: 'so that we can keep your finance pre-approval up to date' },
  R04: { what: 'some standing orders on your account may be counted as finance obligations', ask: 'Please open the QIB Mobile app and tell us what each standing order is for (school fees, family support, rent, other-bank finance). It takes one minute.', why: 'so that your available finance amount is calculated correctly' },
  R08: { what: 'your QIB relationship does not yet include a current account', ask: 'You can open a current account in the QIB Mobile app in a few taps.', why: 'so that you can use One Click Finance when you need it' },
  R13: { what: 'your account has been inactive for some time', ask: 'Please confirm your details in the QIB Mobile app and make any transaction to reactivate it.', why: 'so that your account and your finance pre-approval stay active' },
};
const AR = {
  R07: { what: 'انتهت صلاحية بطاقتك الشخصية القطرية بتاريخ {expiry}', ask: 'يرجى تحميل صورة وجهي البطاقة الشخصية المجددة عبر تطبيق QIB Mobile، أو الرد على هذه الرسالة بالصور.', why: 'لضمان استمرار خدمات حسابك والموافقة المسبقة لتمويل بنقرة واحدة دون انقطاع' },
  R06: { what: 'انتهت صلاحية جواز سفرك المسجل لدينا بتاريخ {expiry}', ask: 'يرجى تحميل صفحة البيانات من جواز سفرك المجدد عبر تطبيق QIB Mobile، أو الرد بالصورة.', why: 'لضمان استمرار خدمات حسابك والموافقة المسبقة للتمويل دون انقطاع' },
  R01: { what: 'لم نلاحظ إيداع راتبك لشهر {months}', ask: 'يرجى تحميل شهادة راتب صادرة خلال آخر 30 يوماً، أو خطاب من جهة عملك يوضح سبب الانقطاع، عبر تطبيق QIB Mobile.', why: 'لتحديث الموافقة المسبقة للتمويل الخاصة بك' },
  R02: { what: 'جهة عملك غير مسجلة في ملفك لدينا', ask: 'يرجى تحميل شهادة راتب حديثة تذكر جهة عملك عبر تطبيق QIB Mobile، أو الرد باسم جهة العمل.', why: 'لتحديث الموافقة المسبقة للتمويل الخاصة بك' },
  R04: { what: 'قد تُحتسب بعض أوامر الدفع الدائمة على حسابك كالتزامات تمويلية', ask: 'يرجى فتح تطبيق QIB Mobile وتحديد الغرض من كل أمر دفع (رسوم مدرسية، دعم عائلي، إيجار، تمويل من بنك آخر). يستغرق ذلك دقيقة واحدة.', why: 'لاحتساب مبلغ التمويل المتاح لك بشكل صحيح' },
  R08: { what: 'علاقتك مع المصرف لا تشمل حساباً جارياً بعد', ask: 'يمكنك فتح حساب جارٍ عبر تطبيق QIB Mobile بخطوات قليلة.', why: 'لتتمكن من استخدام التمويل بنقرة واحدة عند الحاجة' },
  R13: { what: 'حسابك غير نشط منذ فترة', ask: 'يرجى تأكيد بياناتك عبر تطبيق QIB Mobile وإجراء أي عملية لإعادة تفعيله.', why: 'ليبقى حسابك والموافقة المسبقة للتمويل نشطين' },
};
type Reason7 = keyof typeof EN;
const REASONS7 = Object.keys(EN) as Reason7[];

const FOOT_EN = '\n\n{sender}\nReference {ref}. This is a service message about your existing QIB relationship. To stop messages on this channel reply STOP or change your preferences in the app.';
const FOOT_AR = '\n\n{sender}\nالمرجع {ref}. هذه رسالة خدمة تتعلق بعلاقتك القائمة مع المصرف. لإيقاف الرسائل عبر هذه القناة أرسل "إيقاف" أو غيّر تفضيلاتك في التطبيق.';

function build(): Template[] {
  const out: Template[] = [];
  for (const r of REASONS7) {
    const e = EN[r], a = AR[r];
    out.push(
      { key: `${r}:REQUEST:en`, reason: r, type: 'REQUEST', lang: 'en', marketing: r === 'R08', subject: `Action needed: ${e.what.replace('{expiry}', '{expiry}').split(' ').slice(0, 7).join(' ')}`, body: `Dear {name},\n\nWe noticed that ${e.what}. ${e.ask}\n\nWe ask ${e.why}. Once verified, your record is updated within one working day and we will let you know.${FOOT_EN}` },
      { key: `${r}:REQUEST:ar`, reason: r, type: 'REQUEST', lang: 'ar', marketing: r === 'R08', subject: `إجراء مطلوب: ${a.what.split(' ').slice(0, 5).join(' ')}`, body: `عزيزنا {name}،\n\nلاحظنا أن ${a.what}. ${a.ask}\n\nنطلب ذلك ${a.why}. بعد التحقق، يُحدَّث سجلك خلال يوم عمل واحد وسنُعلمك بذلك.${FOOT_AR}` },
      { key: `${r}:REMINDER:en`, reason: r, type: 'REMINDER', lang: 'en', marketing: r === 'R08', subject: `Reminder: ${e.what.split(' ').slice(0, 6).join(' ')}`, body: `Dear {name},\n\nA reminder that ${e.what}, and we have not yet received what we asked for on {firstSent}. ${e.ask}\n\nIf you have already sent it, thank you — no further action is needed.${FOOT_EN}` },
      { key: `${r}:REMINDER:ar`, reason: r, type: 'REMINDER', lang: 'ar', marketing: r === 'R08', subject: `تذكير: ${a.what.split(' ').slice(0, 5).join(' ')}`, body: `عزيزنا {name}،\n\nنذكّرك بأن ${a.what}، ولم نستلم بعد ما طلبناه بتاريخ {firstSent}. ${a.ask}\n\nإذا كنت قد أرسلته بالفعل فنشكرك، ولا حاجة لأي إجراء آخر.${FOOT_AR}` },
      { key: `${r}:FINAL_NOTICE:en`, reason: r, type: 'FINAL_NOTICE', lang: 'en', marketing: false, subject: `Final notice: ${e.what.split(' ').slice(0, 6).join(' ')}`, body: `Dear {name},\n\nThis is our final automated notice: ${e.what}. ${e.ask}\n\nIf we do not hear from you by {deadline}, a QIB representative will call you, and some card services may be temporarily restricted in line with regulatory requirements until your record is updated. Branch services continue.${FOOT_EN}` },
      { key: `${r}:FINAL_NOTICE:ar`, reason: r, type: 'FINAL_NOTICE', lang: 'ar', marketing: false, subject: `إشعار أخير: ${a.what.split(' ').slice(0, 5).join(' ')}`, body: `عزيزنا {name}،\n\nهذا إشعارنا الآلي الأخير: ${a.what}. ${a.ask}\n\nإذا لم نستلم رداً بحلول {deadline}، سيتصل بك أحد ممثلي المصرف، وقد تُقيَّد بعض خدمات البطاقات مؤقتاً وفق المتطلبات التنظيمية إلى حين تحديث سجلك. تستمر خدمات الفروع.${FOOT_AR}` },
      { key: `${r}:RM_BRIEF:en`, reason: r, type: 'RM_BRIEF', lang: 'en', marketing: false, subject: `Brief for {name} ({segment}) — {reasonLabel}`, body: `Client: {name}, {segment}, RIM {rim}. Case {ref}.\nWhat blocks One Click: ${e.what}.\nWhat cures it: ${e.ask.replace('in the QIB Mobile app', 'through you or the app')}\nSuggested approach: a call or message in the client's preferred language; no automated contact is sent for this segment [POL-01 §6.1].\nEligible amount if cured: QAR {amount}.` },
      { key: `${r}:RM_BRIEF:ar`, reason: r, type: 'RM_BRIEF', lang: 'ar', marketing: false, subject: `ملخص للعميل {name} ({segment}) — {reasonLabel}`, body: `العميل: {name}، {segment}، رقم العلاقة {rim}. الحالة {ref}.\nما يمنع التمويل بنقرة واحدة: ${a.what}.\nما يعالجه: ${a.ask}\nالمقترح: اتصال أو رسالة بلغة العميل المفضلة؛ لا يُرسل أي تواصل آلي لهذه الشريحة [POL-01 §6.1].\nالمبلغ المؤهل بعد المعالجة: {amount} ريال قطري.` },
    );
  }
  // Pre-expiry watch (R06/R07 before the expiry date)
  for (const r of ['R07', 'R06'] as const) {
    const doc = r === 'R07' ? ['Qatar ID', 'بطاقتك الشخصية القطرية'] : ['passport', 'جواز سفرك'];
    out.push(
      { key: `${r}:PRE_EXPIRY:en`, reason: r, type: 'PRE_EXPIRY', lang: 'en', marketing: false, subject: `Your ${doc[0]} expires on {expiry}`, body: `Dear {name},\n\nYour ${doc[0]} on our records expires on {expiry}. When you renew it, please upload the new document in the QIB Mobile app so that your account services and your finance pre-approval continue without interruption.${FOOT_EN}` },
      { key: `${r}:PRE_EXPIRY:ar`, reason: r, type: 'PRE_EXPIRY', lang: 'ar', marketing: false, subject: `تنتهي صلاحية ${doc[1]} بتاريخ {expiry}`, body: `عزيزنا {name}،\n\nتنتهي صلاحية ${doc[1]} المسجلة لدينا بتاريخ {expiry}. عند التجديد، يرجى تحميل الوثيقة الجديدة عبر تطبيق QIB Mobile لضمان استمرار خدمات حسابك والموافقة المسبقة للتمويل.${FOOT_AR}` },
    );
  }
  // Early arrears (POL-05, neutral wording)
  const arrears: [MessageType, string, string, string, string][] = [
    ['ARREARS_1', 'A payment is due', 'Dear {name},\n\nThe instalment of QAR {due} on your {product} was due on {dueDate} and has not been received. If you have already paid, thank you. Otherwise you can pay in the QIB Mobile app.', 'دفعة مستحقة', 'عزيزنا {name}،\n\nالقسط البالغ {due} ريال قطري على {product} كان مستحقاً بتاريخ {dueDate} ولم يُستلم بعد. إذا كنت قد سددته فنشكرك، وإلا يمكنك السداد عبر تطبيق QIB Mobile.'],
    ['ARREARS_4', 'Reminder: payment outstanding', 'Dear {name},\n\nThe instalment of QAR {due} on your {product} is still outstanding ({dpd} days). You can pay in the QIB Mobile app. If you are facing difficulty, reply to this message and a QIB representative will contact you.', 'تذكير: دفعة متأخرة', 'عزيزنا {name}،\n\nلا يزال القسط البالغ {due} ريال قطري على {product} مستحقاً ({dpd} يوماً). يمكنك السداد عبر تطبيق QIB Mobile. إذا كنت تواجه صعوبة، فالرجاء الرد على هذه الرسالة وسيتواصل معك أحد ممثلي المصرف.'],
    ['ARREARS_7', 'Call task: payment outstanding', 'Call {name} about the instalment of QAR {due} on {product}, {dpd} days past due. Neutral tone; offer the app payment path; record any hardship.', 'مهمة اتصال: دفعة متأخرة', 'الاتصال بالعميل {name} بخصوص القسط البالغ {due} ريال قطري على {product}، متأخر {dpd} يوماً. نبرة محايدة؛ عرض السداد عبر التطبيق؛ تسجيل أي حالة عسر.'],
    ['ARREARS_10', 'Notice of overdue payment', 'Dear {name},\n\nWe write to let you know that the instalment of QAR {due} on your {product} remains unpaid {dpd} days after its due date. Please settle it or contact us to discuss your options. This letter is sent in line with QIB\'s collections policy.', 'إشعار بدفعة متأخرة', 'عزيزنا {name}،\n\nنود إعلامك بأن القسط البالغ {due} ريال قطري على {product} لا يزال غير مسدد بعد {dpd} يوماً من تاريخ استحقاقه. يرجى السداد أو التواصل معنا لمناقشة الخيارات المتاحة. يُرسل هذا الخطاب وفق سياسة التحصيل في المصرف.'],
  ];
  for (const [type, se, be, sa, ba] of arrears) {
    out.push({ key: `ARREARS:${type}:en`, reason: 'R15', type, lang: 'en', marketing: false, subject: se, body: be + (type === 'ARREARS_7' ? '' : FOOT_EN) }, { key: `ARREARS:${type}:ar`, reason: 'R15', type, lang: 'ar', marketing: false, subject: sa, body: ba + (type === 'ARREARS_7' ? '' : FOOT_AR) });
  }
  // Offers (marketing consent required, POL-07 §2.1) and service confirmations
  out.push(
    { key: 'OFFER:en', reason: null, type: 'OFFER', lang: 'en', marketing: true, subject: 'You are pre-approved for QAR {amount} with One Click Finance', body: 'Dear {name},\n\nGood news: you are pre-approved for personal finance of up to QAR {amount} over up to {tenor} months. Open the QIB Mobile app, go to One Click Finance and accept in one tap. Funds reach your current account the same day.\n\nThis is an offer based on your updated records; the final decision follows QIB\'s financing policy.' + FOOT_EN.replace('This is a service message about your existing QIB relationship.', 'You receive offers because you opted in to marketing messages.') },
    { key: 'OFFER:ar', reason: null, type: 'OFFER', lang: 'ar', marketing: true, subject: 'لديك موافقة مسبقة على تمويل بقيمة {amount} ريال قطري', body: 'عزيزنا {name}،\n\nخبر سار: لديك موافقة مسبقة على تمويل شخصي يصل إلى {amount} ريال قطري لمدة تصل إلى {tenor} شهراً. افتح تطبيق QIB Mobile، ثم "التمويل بنقرة واحدة"، واقبل بنقرة واحدة. يصل المبلغ إلى حسابك الجاري في اليوم نفسه.\n\nهذا عرض مبني على بياناتك المحدثة؛ والقرار النهائي وفق سياسة التمويل في المصرف.' + FOOT_AR.replace('هذه رسالة خدمة تتعلق بعلاقتك القائمة مع المصرف.', 'تصلك العروض لأنك وافقت على استلام الرسائل التسويقية.') },
    { key: 'SALARY_TRANSFER_OFFER:en', reason: 'R01', type: 'SALARY_TRANSFER_OFFER', lang: 'en', marketing: true, subject: 'Transfer your salary to QIB', body: 'Dear {name},\n\nTransferring your salary to your QIB account keeps your finance pre-approval active and gives you access to One Click Finance. You can request the transfer letter in the QIB Mobile app.' + FOOT_EN.replace('This is a service message about your existing QIB relationship.', 'You receive offers because you opted in to marketing messages.') },
    { key: 'SALARY_TRANSFER_OFFER:ar', reason: 'R01', type: 'SALARY_TRANSFER_OFFER', lang: 'ar', marketing: true, subject: 'حوّل راتبك إلى المصرف', body: 'عزيزنا {name}،\n\nتحويل راتبك إلى حسابك لدى المصرف يبقي الموافقة المسبقة للتمويل نشطة ويتيح لك التمويل بنقرة واحدة. يمكنك طلب خطاب التحويل عبر تطبيق QIB Mobile.' + FOOT_AR.replace('هذه رسالة خدمة تتعلق بعلاقتك القائمة مع المصرف.', 'تصلك العروض لأنك وافقت على استلام الرسائل التسويقية.') },
    { key: 'ACK_HARDSHIP:en', reason: null, type: 'ACK_HARDSHIP', lang: 'en', marketing: false, subject: 'We have received your message', body: 'Dear {name},\n\nThank you for telling us. We have paused all automated messages on your account and a QIB representative will contact you within one working day to discuss how we can help.' + FOOT_EN },
    { key: 'ACK_HARDSHIP:ar', reason: null, type: 'ACK_HARDSHIP', lang: 'ar', marketing: false, subject: 'استلمنا رسالتك', body: 'عزيزنا {name}،\n\nشكراً لإخبارنا. أوقفنا جميع الرسائل الآلية على حسابك وسيتواصل معك أحد ممثلي المصرف خلال يوم عمل واحد لمناقشة كيف يمكننا المساعدة.' + FOOT_AR },
    { key: 'ACK_COMPLAINT:en', reason: null, type: 'ACK_COMPLAINT', lang: 'en', marketing: false, subject: 'Your complaint has been registered', body: 'Dear {name},\n\nWe have registered your complaint under reference {ref} and paused all automated messages on your account. A member of our complaints team will contact you within one working day.' + FOOT_EN },
    { key: 'ACK_COMPLAINT:ar', reason: null, type: 'ACK_COMPLAINT', lang: 'ar', marketing: false, subject: 'تم تسجيل شكواك', body: 'عزيزنا {name}،\n\nسجلنا شكواك تحت المرجع {ref} وأوقفنا جميع الرسائل الآلية على حسابك. سيتواصل معك أحد أعضاء فريق الشكاوى خلال يوم عمل واحد.' + FOOT_AR },
    { key: 'OPTOUT_CONFIRM:en', reason: null, type: 'OPTOUT_CONFIRM', lang: 'en', marketing: false, subject: 'Your preference has been updated', body: 'Dear {name},\n\nYou will no longer receive {what} from QIB. The change takes effect within two business days. Messages about your existing accounts and documents continue, as the law requires.' + FOOT_EN },
    { key: 'OPTOUT_CONFIRM:ar', reason: null, type: 'OPTOUT_CONFIRM', lang: 'ar', marketing: false, subject: 'تم تحديث تفضيلاتك', body: 'عزيزنا {name}،\n\nلن تصلك بعد الآن {what} من المصرف. يسري التغيير خلال يومي عمل. تستمر الرسائل المتعلقة بحساباتك ووثائقك القائمة كما يقتضي القانون.' + FOOT_AR },
    { key: 'DOC_REJECTED:en', reason: null, type: 'DOC_REJECTED', lang: 'en', marketing: false, subject: 'We could not accept the document you sent', body: 'Dear {name},\n\nThank you for sending your {docType}. We could not accept it because {why}. Please upload {docAsk} in the QIB Mobile app.' + FOOT_EN },
    { key: 'DOC_REJECTED:ar', reason: null, type: 'DOC_REJECTED', lang: 'ar', marketing: false, subject: 'لم نتمكن من قبول الوثيقة المرسلة', body: 'عزيزنا {name}،\n\nشكراً لإرسال {docType}. لم نتمكن من قبولها لأن {why}. يرجى تحميل {docAsk} عبر تطبيق QIB Mobile.' + FOOT_AR },
    { key: 'REQUALIFIED_INFO:en', reason: null, type: 'REQUALIFIED_INFO', lang: 'en', marketing: false, subject: 'Your record has been updated', body: 'Dear {name},\n\nThank you. Your {what} has been verified and your record updated.' + FOOT_EN },
    { key: 'REQUALIFIED_INFO:ar', reason: null, type: 'REQUALIFIED_INFO', lang: 'ar', marketing: false, subject: 'تم تحديث سجلك', body: 'عزيزنا {name}،\n\nشكراً لك. تم التحقق من {what} وتحديث سجلك.' + FOOT_AR },
    { key: 'EMPLOYER_INFO:en', reason: 'R02', type: 'EMPLOYER_INFO', lang: 'en', marketing: false, subject: 'Your employer is now registered with QIB', body: 'Dear {name},\n\nYour employer, {employer}, has been added to QIB\'s approved list. Your profile has been updated accordingly; no action is needed from you.' + FOOT_EN },
    { key: 'EMPLOYER_INFO:ar', reason: 'R02', type: 'EMPLOYER_INFO', lang: 'ar', marketing: false, subject: 'تم تسجيل جهة عملك لدى المصرف', body: 'عزيزنا {name}،\n\nأُضيفت جهة عملك، {employer}، إلى قائمة جهات العمل المعتمدة لدى المصرف. تم تحديث ملفك وفقاً لذلك، ولا حاجة لأي إجراء منك.' + FOOT_AR },
  );
  return out;
}

export const TEMPLATES: Template[] = build();
export const TEMPLATE = Object.fromEntries(TEMPLATES.map((t) => [t.key, t])) as Record<string, Template>;

/** Pick the template for a reason, type and language; falls back to R07 wording for reasons without their own. */
export function templateFor(reason: ReasonCode | null, type: MessageType, lang: Lang): Template {
  if (type === 'OFFER' || type === 'ACK_HARDSHIP' || type === 'ACK_COMPLAINT' || type === 'OPTOUT_CONFIRM' || type === 'DOC_REJECTED' || type === 'REQUALIFIED_INFO') return TEMPLATE[`${type}:${lang}`];
  if (type === 'SALARY_TRANSFER_OFFER' || type === 'EMPLOYER_INFO') return TEMPLATE[`${type}:${lang}`];
  if (type.startsWith('ARREARS')) return TEMPLATE[`ARREARS:${type}:${lang}`];
  const r = reason && TEMPLATE[`${reason}:${type}:${lang}`] ? reason : 'R07';
  return TEMPLATE[`${r}:${type}:${lang}`];
}

export function fill(text: string, vars: Vars): string {
  return text.replace(/\{(\w+)\}/g, (_m, k) => (vars[k] === undefined || vars[k] === null ? `{${k}}` : String(vars[k])));
}

/** The channel rendering derived from one body. */
export function render(t: Template, vars: Vars, channel: Channel): { subject: string; body: string } {
  const subject = fill(t.subject, vars);
  const full = fill(t.body, vars);
  const firstPara = full.split('\n\n').find((p) => !/^(Dear|عزيزنا)/.test(p.trim())) ?? full;
  if (channel === 'PUSH') return { subject, body: firstPara.split(/(?<=[.؟!])\s/)[0].slice(0, 140) };
  if (channel === 'SMS') {
    const core = firstPara.replace(/\s+/g, ' ').trim();
    const tail = t.lang === 'ar' ? ' — QIB. إيقاف: STOP' : ' — QIB. Opt out: STOP';
    return { subject, body: core.slice(0, Math.max(40, 160 - tail.length)) + tail };
  }
  return { subject, body: full };
}
