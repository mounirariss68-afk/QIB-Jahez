/**
 * The eighteen workflows (DESIGN §6), in the Tasama HR shape: typed steps
 * with actor, inputs, outputs and the decision each makes. `actor_type` is
 * AGENT, HUMAN or SYSTEM; a HUMAN step's `actor` is a persona key resolved by
 * the engine (rm = the customer's own RM; `approver` = per segment or domain
 * from the policy). SYSTEM steps are the only writes to the core schema
 * (Muhaddith through the connector). A step marked `waits` parks the run until
 * an event (a customer reply, a payment, a timeout) resumes it.
 */
export type StepDef = {
  key: string; actor_type: 'AGENT' | 'HUMAN' | 'SYSTEM'; actor: string;
  label: string; label_ar: string; inputs: string; outputs: string; decision: string;
  /** The event that resumes this step when it parks the run. */
  waits?: 'REPLY' | 'PAYMENT' | 'TIMEOUT' | 'EVENT';
};
export type WorkflowDef = {
  id: string; num: number; name: string; name_ar: string; cls: 'A' | 'B' | 'C' | 'D' | 'X'; coverage: 'implemented' | 'partial' | 'designed';
  trigger: string; reasons: string[]; agents: string[]; decision_by: string; steps: StepDef[];
};

const S = (key: string, actor_type: StepDef['actor_type'], actor: string, label: string, label_ar: string, inputs: string, outputs: string, decision: string, waits?: StepDef['waits']): StepDef =>
  ({ key, actor_type, actor, label, label_ar, inputs, outputs, decision, ...(waits ? { waits } : {}) });

/** The shared "ask the customer for a document" spine used by WF-02/03/04/05(missing)/07/09(dormant). */
const ASK = (what: string, what_ar: string, checker: string, checkerLabel: string, checkerLabel_ar: string): StepDef[] => [
  S('plan', 'AGENT', 'munadi', 'Plan the notice sequence', 'تخطيط تسلسل الإشعارات', 'Case, segment, POL-01/02, calendar, consents', 'Attempts, channels in order, first send time', 'Which channel first; RM-first segments get a brief instead'),
  S('send', 'AGENT', 'munadi', `Send the ${what} request through Hami`, `إرسال طلب ${what_ar} عبر حامي`, 'Rendered template, next window', 'Message scheduled or sent; or blocked with the clause', 'None — Hami allows or blocks'),
  S('await', 'AGENT', 'mustaqbil', 'Wait for the reply; classify it', 'انتظار الرد وتصنيفه', 'Inbound message or upload; or the reminder deadline', 'Document → examiner; question → draft reply; opt-out/hardship → WF-16; timeout → escalation', 'What the reply is', 'REPLY'),
  S('examine', 'AGENT', 'fahis', `Extract and verify the ${what}`, `استخراج ${what_ar} والتحقق منها`, 'Image or file, the record', 'Extracted fields, verification flags, confidence, assurance, proposed update', 'Recommend approve or reject'),
  S('check', 'HUMAN', checker, checkerLabel, checkerLabel_ar, 'Proposal with before/after and confidence', 'Approved or rejected with a reason', 'Whether the record changes'),
  S('apply', 'SYSTEM', 'muhaddith', 'Apply the approved update to the record', 'تطبيق التحديث المعتمد على السجل', 'Approved proposal', 'PATCH core.<table>; before/after on the trail', 'None'),
  S('requalify', 'AGENT', 'muahil', 'Re-qualify and hand off', 'إعادة التأهيل والإحالة', 'Updated record, POL-04', 'Eligible → WF-15; else remaining reasons on the case', 'None — the bank\'s model remains the credit decision'),
  S('escalate', 'AGENT', 'munadi', 'Attempts exhausted: hand to a person', 'استنفاد المحاولات: الإحالة إلى شخص', 'Unanswered notices', 'WF-17 opened (RM brief or call task; restriction proposal if POL-02 says so)', 'None'),
];

export const WORKFLOWS: WorkflowDef[] = [
  { id: 'WF-01', num: 1, name: 'Nightly data-health scan', name_ar: 'الفحص الليلي لجودة البيانات', cls: 'X', coverage: 'implemented', trigger: '02:00 Doha daily; on demand; on clock advance', reasons: [], agents: ['raqib'], decision_by: 'None (A3)',
    steps: [
      S('load', 'AGENT', 'raqib', 'Load the customer base', 'تحميل قاعدة العملاء', 'core.* through the connector', 'Customer facts', 'None'),
      S('qualify', 'AGENT', 'raqib', 'Run the twenty-reason check', 'تشغيل فحص الأسباب العشرين', 'Facts, active policy version', 'Eligible / reasons / class per customer', 'None'),
      S('diff', 'AGENT', 'raqib', 'Diff with the previous run', 'المقارنة مع التشغيل السابق', 'Previous results', 'New fall-outs, cures, reasons added or cleared', 'None'),
      S('cases', 'AGENT', 'raqib', 'Open, update or close cases', 'فتح الحالات وتحديثها وإغلاقها', 'Diff, open cases', 'One case per customer, classed; workflows started for new class A/B cases', 'Which workflow handles each case'),
      S('health', 'AGENT', 'raqib', 'Compute data health', 'حساب جودة البيانات', 'Facts', 'Field-level metrics, expiries ahead, contactability', 'None'),
      S('summary', 'AGENT', 'raqib', 'Write the run summary', 'كتابة ملخص التشغيل', 'All of the above', 'preapproval_runs row; Activity console entry', 'None'),
    ] },
  { id: 'WF-02', num: 2, name: 'QID refresh', name_ar: 'تجديد البطاقة الشخصية', cls: 'A', coverage: 'implemented', trigger: 'R07 (fall-out), or the pre-expiry watch at T-90', reasons: ['R07'], agents: ['munadi', 'hami', 'mustaqbil', 'fahis', 'muhaddith', 'muahil'], decision_by: 'Checker on the update; approver on any restriction',
    steps: ASK('QID', 'البطاقة الشخصية', 'supervisor', 'Checker approves the QID update', 'المدقق يعتمد تحديث البطاقة') },
  { id: 'WF-03', num: 3, name: 'Passport refresh', name_ar: 'تجديد جواز السفر', cls: 'A', coverage: 'implemented', trigger: 'R06 (fall-out, residents), or the pre-expiry watch at T-90', reasons: ['R06'], agents: ['munadi', 'hami', 'mustaqbil', 'fahis', 'muhaddith', 'muahil'], decision_by: 'Checker on the update (MRZ check digits verified); approver on any restriction',
    steps: ASK('passport', 'جواز السفر', 'supervisor', 'Checker approves the passport update', 'المدقق يعتمد تحديث جواز السفر') },
  { id: 'WF-04', num: 4, name: 'Salary evidence', name_ar: 'إثبات الراتب', cls: 'A', coverage: 'implemented', trigger: 'R01; status blocked-salary', reasons: ['R01'], agents: ['munadi', 'hami', 'mustaqbil', 'fahis', 'muhaddith', 'muahil'], decision_by: 'Credit Policy (HV/HNWI/VVIP) or Supervisor (Mass) on an explained gap; consent gate on the salary-transfer offer',
    steps: [
      ...ASK('salary certificate', 'شهادة الراتب', 'approver:explainedGapApprover', 'Accept the explained gap or park', 'قبول الانقطاع المبرر أو الإيقاف').map((s) => s.key === 'examine' ? { ...s, label: 'Certificate against the record and the credits', label_ar: 'الشهادة مقابل السجل والإيداعات', outputs: 'Employer, salary, date checks; explained gap proposal; salary-paid-elsewhere flag' } : s),
      S('offer', 'AGENT', 'hami', 'Salary paid elsewhere: consent check, then the transfer offer', 'الراتب يُدفع في بنك آخر: فحص الموافقة ثم عرض التحويل', 'Consents, POL-03 §3.1, POL-07 §2.1', 'Separate offer message (with consent) or an RM/branch task; case parks cured-awaiting-history', 'Consent allows the offer or not'),
    ] },
  { id: 'WF-05', num: 5, name: 'Employer missing or unapproved', name_ar: 'جهة العمل مفقودة أو غير معتمدة', cls: 'A', coverage: 'implemented', trigger: 'R02', reasons: ['R02'], agents: ['munadi', 'mustaqbil', 'fahis', 'muwathiq', 'muhaddith', 'muahil'], decision_by: 'Checker on the field (missing); Credit Policy on the employer (unapproved)',
    steps: [
      S('route', 'AGENT', 'muwathiq', 'Missing or unapproved?', 'مفقودة أم غير معتمدة؟', 'Employment record, register', 'The variant to run', 'Ask the customer (missing) or review the employer (unapproved)'),
      ...ASK('employer details', 'بيانات جهة العمل', 'supervisor', 'Checker approves the employer field', 'المدقق يعتمد حقل جهة العمل'),
      S('pack', 'AGENT', 'muwathiq', 'Build the employer approval pack', 'إعداد ملف اعتماد جهة العمل', 'Register, POL-03 §5.1 criteria, QIB-salaried customers', 'Pack with each criterion, affected customers, recommendation', 'Recommend approve or decline'),
      S('decide', 'HUMAN', 'credit', 'Credit Policy decides the employer', 'سياسة الائتمان تقرر بشأن جهة العمل', 'Pack', 'Approved, declined or restricted', 'Whether the employer is approved'),
      S('apply_employer', 'SYSTEM', 'muhaddith', 'Write the employer status', 'كتابة حالة جهة العمل', 'Decision', 'PATCH core.employers', 'None'),
      S('requalify_all', 'AGENT', 'muahil', 'Re-qualify every customer of the employer', 'إعادة تأهيل كل عملاء جهة العمل', 'Employer\'s customers', 'Eligible → WF-15 each; cases closed cured', 'None'),
      S('inform', 'AGENT', 'munadi', 'Tell the affected customers', 'إبلاغ العملاء المتأثرين', 'Affected customers, template EMPLOYER_INFO', 'Service messages through Hami', 'None'),
    ] },
  { id: 'WF-06', num: 6, name: 'Inbound processing', name_ar: 'معالجة الوارد', cls: 'X', coverage: 'implemented', trigger: 'Any inbound message (app, e-mail, mailbox simulator)', reasons: [], agents: ['mustaqbil', 'fahis', 'munadi'], decision_by: 'A person on hardship, complaint, dispute and unmatched mail',
    steps: [
      S('match', 'AGENT', 'mustaqbil', 'Match to a customer and a case', 'مطابقة العميل والحالة', 'In-app identity; e-mail reference token or sender address', 'Customer, case; or unmatched', 'Matched or unmatched'),
      S('classify', 'AGENT', 'mustaqbil', 'Classify the message', 'تصنيف الرسالة', 'Text, attachments', 'document · question · dispute · opt-out · hardship · complaint · out-of-office · unrelated, with confidence and mode', 'The class'),
      S('route', 'AGENT', 'mustaqbil', 'Route it', 'توجيهها', 'Class, waiting run', 'Resumes the waiting step; opens WF-16; drafts a reply; reschedules; archives', 'Where it goes'),
      S('review', 'HUMAN', 'ops', 'Unmatched mail: a person reads it', 'بريد غير مطابق: شخص يقرؤه', 'The message', 'Matched by hand or archived', 'Whose message it is'),
    ] },
  { id: 'WF-07', num: 7, name: 'Standing orders', name_ar: 'أوامر الدفع الدائمة', cls: 'A', coverage: 'implemented', trigger: 'R04', reasons: ['R04'], agents: ['munadi', 'mustaqbil', 'fahis', 'muhaddith', 'muahil'], decision_by: 'Checker on the reclassification; Credit on consolidation',
    steps: ASK('standing-order declaration', 'تصنيف أوامر الدفع', 'supervisor', 'Checker approves the reclassification', 'المدقق يعتمد إعادة التصنيف').map((s) => s.key === 'examine' ? { ...s, label: 'Declaration and liability letter, if any', label_ar: 'الإقرار وخطاب الالتزامات إن وُجد', outputs: 'Per-order classification proposal; liability letter check' } : s) },
  { id: 'WF-08', num: 8, name: 'Current account', name_ar: 'الحساب الجاري', cls: 'A', coverage: 'partial', trigger: 'R08', reasons: ['R08'], agents: ['hami', 'munadi', 'mustaqbil', 'muhaddith', 'muahil'], decision_by: 'Consent gate; checker on the account flag',
    steps: [
      S('consent', 'AGENT', 'hami', 'Marketing consent?', 'هل توجد موافقة تسويقية؟', 'Consents, POL-07 §2.1', 'With consent → in-app offer; without → Mass parks awaiting-consent, High Value and above get an RM/branch task', 'Whether an offer may be sent'),
      S('offer', 'AGENT', 'munadi', 'Send the current-account offer', 'إرسال عرض الحساب الجاري', 'Template R08, window', 'Message through Hami', 'None'),
      S('await', 'AGENT', 'mustaqbil', 'Wait for acceptance', 'انتظار القبول', 'In-app acceptance', 'Accepted / declined / timeout', 'What the reply is', 'REPLY'),
      S('check', 'HUMAN', 'supervisor', 'Checker approves the account opening (simulated)', 'المدقق يعتمد فتح الحساب (محاكاة)', 'Acceptance', 'Approved', 'Whether the account flag is set'),
      S('apply', 'SYSTEM', 'muhaddith', 'Set the current-account flag', 'تعيين علامة الحساب الجاري', 'Approval', 'POST core.accounts (simulated opening)', 'None'),
      S('requalify', 'AGENT', 'muahil', 'Re-qualify and hand off', 'إعادة التأهيل والإحالة', 'Updated record', 'Eligible → WF-15', 'None'),
    ] },
  { id: 'WF-09', num: 9, name: 'Status not Normal', name_ar: 'حالة العميل غير طبيعية', cls: 'A', coverage: 'implemented', trigger: 'R13', reasons: ['R13'], agents: ['raqib', 'munadi', 'mustaqbil', 'fahis', 'muhaddith', 'muahil'], decision_by: 'Checker on the status change; Compliance for frozen, deceased, closed',
    steps: [
      S('triage', 'AGENT', 'raqib', 'Which sub-status?', 'أي حالة فرعية؟', 'Status, reference list', 'Dormant → reactivation; blocked-KYC → WF-02/03; blocked-salary → WF-04; blocked-delinquency → WF-12; frozen/deceased/closed → Compliance queue', 'The route'),
      ...ASK('reactivation', 'إعادة التفعيل', 'supervisor', 'Checker approves the status change', 'المدقق يعتمد تغيير الحالة'),
      S('compliance', 'HUMAN', 'compliance', 'Compliance reviews the frozen or closed status', 'الامتثال يراجع الحالة المجمدة أو المغلقة', 'Status, note', 'Kept or lifted', 'Whether anything changes'),
    ] },
  { id: 'WF-10', num: 10, name: 'Cautionary note', name_ar: 'الملاحظة التحذيرية', cls: 'B', coverage: 'implemented', trigger: 'R05', reasons: ['R05'], agents: ['raqib', 'hami', 'muahil'], decision_by: 'Compliance',
    steps: [
      S('queue', 'AGENT', 'raqib', 'Queue for Compliance with origin and lifting condition', 'إحالة إلى الامتثال مع المصدر وشرط الرفع', 'Note', 'Compliance task; no contact', 'None'),
      S('decide', 'HUMAN', 'compliance', 'Compliance clears, reclassifies or keeps the note', 'الامتثال يرفع الملاحظة أو يعيد تصنيفها أو يبقيها', 'Note, evidence (discharge certificate, delisting)', 'Cleared / reclassified to WF-02/03/04 / kept', 'What happens to the note'),
      S('apply', 'SYSTEM', 'muhaddith', 'Lift the note on the record', 'رفع الملاحظة من السجل', 'Decision', 'PATCH core.cautionary_notes', 'None'),
      S('requalify', 'AGENT', 'muahil', 'Re-qualify', 'إعادة التأهيل', 'Updated record', 'Eligible → WF-15; else remaining reasons', 'None'),
    ] },
  { id: 'WF-11', num: 11, name: 'Exposure exceeded', name_ar: 'تجاوز حد التعرض', cls: 'B', coverage: 'implemented', trigger: 'R03', reasons: ['R03'], agents: ['raqib', 'muahil'], decision_by: 'Credit Policy (consolidation, optional)',
    steps: [
      S('timeline', 'AGENT', 'raqib', 'Headroom timeline from the maturities', 'الجدول الزمني للهامش من تواريخ الاستحقاق', 'Facilities, cap', 'The date headroom appears; no outreach', 'None'),
      S('review', 'HUMAN', 'credit', 'Credit Policy considers consolidation', 'سياسة الائتمان تنظر في التوحيد', 'Timeline', 'Consolidation case or none', 'Whether to consolidate'),
      S('schedule', 'AGENT', 'raqib', 'Schedule the re-check at the next maturity', 'جدولة إعادة الفحص عند الاستحقاق التالي', 'Timeline', 'Re-check date on the case', 'None'),
    ] },
  { id: 'WF-12', num: 12, name: 'Early arrears', name_ar: 'المتأخرات المبكرة', cls: 'D', coverage: 'partial', trigger: 'R15, R16 at DPD 1–30', reasons: ['R15', 'R16'], agents: ['munabbih', 'hami', 'muahil'], decision_by: 'Collections at the hand-off',
    steps: [
      S('cadence', 'AGENT', 'munabbih', 'Schedule the reminder cadence', 'جدولة تسلسل التذكير', 'DPD, POL-05 §2.1 cadence, caps', 'Day-1 push, day-4 e-mail/SMS, day-7 call task, day-10 letter — one action a day, through Hami', 'None'),
      S('await', 'AGENT', 'munabbih', 'Wait for payment or the DPD boundary', 'انتظار السداد أو حد أيام التأخر', 'Payments, nightly DPD', 'Paid → cooling; DPD at the limit → hand-off', 'Which happened', 'PAYMENT'),
      S('handoff', 'AGENT', 'munabbih', 'Hand over to Collections and stop', 'التسليم إلى التحصيل والتوقف', 'DPD ≥ collectionsHandoffDpd', 'Task to Collections; all reminders cancelled; offers suppressed', 'None'),
      S('ack', 'HUMAN', 'collections', 'Collections acknowledges the hand-off', 'التحصيل يؤكد الاستلام', 'Task', 'Acknowledged', 'None'),
      S('cooling', 'AGENT', 'muahil', 'Start the cooling period and schedule the re-check', 'بدء فترة الانتظار وجدولة إعادة الفحص', 'Payment date, coolingMonthsAfterCure', 'Re-check date on the case', 'None'),
    ] },
  { id: 'WF-13', num: 13, name: 'Payment conduct watch', name_ar: 'مراقبة سلوك السداد', cls: 'D', coverage: 'implemented', trigger: 'R14, R17', reasons: ['R14', 'R17'], agents: ['raqib'], decision_by: 'None',
    steps: [
      S('suppress', 'AGENT', 'raqib', 'Suppress offers; record the condition that lifts it', 'حجب العروض وتسجيل شرط الرفع', 'Facilities, cheques, bureau ageing', 'Regular months to go, or the bureau delisting date; no contact', 'None'),
      S('schedule', 'AGENT', 'raqib', 'Schedule the re-check', 'جدولة إعادة الفحص', 'Condition', 'Re-check date on the case', 'None'),
    ] },
  { id: 'WF-14', num: 14, name: 'Policy exclusions', name_ar: 'الاستثناءات بحسب السياسة', cls: 'C', coverage: 'implemented', trigger: 'R09, R10, R11, R12, R18, R19, R20', reasons: ['R09', 'R10', 'R11', 'R12', 'R18', 'R19', 'R20'], agents: ['raqib'], decision_by: 'None',
    steps: [
      S('record', 'AGENT', 'raqib', 'Record the reason and the event that could change it', 'تسجيل السبب والحدث الذي قد يغيره', 'Reasons, model and rating dates, birthdays, list changes', 'Re-check trigger: monthly re-score, birthday, list change', 'None'),
      S('schedule', 'AGENT', 'raqib', 'Suppress and schedule the re-check', 'الحجب وجدولة إعادة الفحص', 'Trigger', 'Re-check date on the case; no contact', 'None'),
    ] },
  { id: 'WF-15', num: 15, name: 'Re-qualification and hand-off', name_ar: 'إعادة التأهيل والإحالة', cls: 'X', coverage: 'implemented', trigger: 'Any approved record change; cooling period end; scheduled re-check; employer approval', reasons: [], agents: ['muahil', 'hami', 'munadi'], decision_by: 'Hami consent check; the RM for HNWI and VVIP',
    steps: [
      S('qualify', 'AGENT', 'muahil', 'Run the eligibility check and compute the amount', 'تشغيل فحص الأهلية وحساب المبلغ', 'Record, POL-04', 'Eligible / amount / tenor, or remaining reasons', 'None'),
      S('guard', 'AGENT', 'hami', 'Consent and suppression check on the offer', 'فحص الموافقة والحجب على العرض', 'Consents, DPD, lists, POL-05/07', 'Allowed, or blocked with the clause (case closes cured-awaiting-consent)', 'Whether an offer may go'),
      S('approve', 'HUMAN', 'rm', 'The RM approves the hand-off (HNWI) or sends it (VVIP)', 'مدير العلاقة يعتمد الإحالة أو يرسلها', 'Offer, amount', 'Approved, or sent by the RM', 'Whether the offer goes'),
      S('push', 'AGENT', 'munadi', 'One Click push (simulated) on the segment\'s offer channel', 'إشعار التمويل بنقرة واحدة (محاكاة)', 'Template OFFER, offerChannel', 'Offer rendered on the customer\'s phone; ONECLICK integration log', 'None'),
    ] },
  { id: 'WF-16', num: 16, name: 'Opt-out, DNC, hardship, complaint', name_ar: 'إلغاء الاشتراك، عدم التواصل، العسر، الشكوى', cls: 'X', coverage: 'implemented', trigger: 'Inbound classified so; Compliance entry', reasons: [], agents: ['hami', 'mustaqbil', 'munadi'], decision_by: 'A person; Compliance for DNC',
    steps: [
      S('apply', 'AGENT', 'hami', 'Apply the suppression or the pause', 'تطبيق الحجب أو الإيقاف', 'Kind: marketing opt-out · channel opt-out · DNC · hardship · complaint · dispute', 'Opt-out within 2 business days keeping one service channel; DNC blocks all but the regulatory letter; hardship/complaint/dispute pause all automated outreach', 'Which rule applies'),
      S('human', 'HUMAN', 'ops', 'A person takes the case', 'شخص يتولى الحالة', 'The message, the pause', 'Outcome recorded', 'What to do for the customer'),
      S('ack', 'AGENT', 'munadi', 'Acknowledge to the customer', 'إشعار العميل بالاستلام', 'Template ACK_*/OPTOUT_CONFIRM', 'Acknowledgement through Hami (service message)', 'None'),
    ] },
  { id: 'WF-17', num: 17, name: 'Escalation', name_ar: 'التصعيد', cls: 'X', coverage: 'implemented', trigger: 'Attempts exhausted; segment rule', reasons: [], agents: ['munadi', 'hami'], decision_by: 'Approver per segment for a restriction',
    steps: [
      S('brief', 'AGENT', 'munadi', 'RM brief or contact-centre call task', 'ملخص لمدير العلاقة أو مهمة اتصال', 'Case history, template RM_BRIEF (Claude-drafted where connected, reviewed)', 'Task to the RM (HNWI, VVIP) or the contact centre (Mass, High Value)', 'Who steps in'),
      S('propose', 'AGENT', 'hami', 'Propose a temporary restriction if POL-02 says so', 'اقتراح تقييد مؤقت إذا نصت السياسة', 'Days since expiry ≥ restrictionProposalDay; notices sent; the call task\'s outcome (recorded on the task)', 'Restriction proposal to the approver, never automatic', 'Whether to propose', 'TIMEOUT'),
      S('decide', 'HUMAN', 'approver:restrictionApprover', 'Approver decides the restriction', 'المعتمد يقرر التقييد', 'Proposal, notices sent, dates', 'Approved or declined with a reason', 'Whether cards are restricted'),
      S('apply', 'SYSTEM', 'muhaddith', 'Apply the restriction flag', 'تطبيق علامة التقييد', 'Approval', 'PATCH core.customers (card_restricted); regulatory letter by post', 'None'),
    ] },
  { id: 'WF-18', num: 18, name: 'Policy change', name_ar: 'تغيير السياسة', cls: 'X', coverage: 'implemented', trigger: 'A persona proposes a change', reasons: [], agents: ['hami'], decision_by: 'Approver per domain',
    steps: [
      S('diff', 'AGENT', 'hami', 'Diff and effect preview', 'المقارنة ومعاينة الأثر', 'Proposed values, current version', 'What changes, which scheduled messages move, which cases are affected', 'None'),
      S('approve', 'HUMAN', 'approver:domain', 'The domain approver decides', 'معتمد المجال يقرر', 'Diff, preview', 'Approved or declined', 'Whether the version takes effect'),
      S('version', 'SYSTEM', 'policy', 'Create the new version', 'إنشاء الإصدار الجديد', 'Approval', 'policy_versions row; effective now', 'None'),
      S('replan', 'AGENT', 'hami', 'Re-plan scheduled messages under the new version', 'إعادة جدولة الرسائل وفق الإصدار الجديد', 'Scheduled messages', 'Rescheduled rows with the new version stamped', 'None'),
    ] },
];

export const WORKFLOW = Object.fromEntries(WORKFLOWS.map((w) => [w.id, w])) as Record<string, WorkflowDef>;
export const wf = (id: string): WorkflowDef => { const w = WORKFLOW[id]; if (!w) throw new Error(`Unknown workflow ${id}`); return w; };
/** The workflow that handles a reason, from the reasons table. */
export const workflowForReason = (code: string): string => WORKFLOWS.find((w) => w.reasons.includes(code))?.id ?? 'WF-14';
