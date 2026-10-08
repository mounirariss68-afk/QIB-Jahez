/**
 * The agent registry: ten named colleagues (DESIGN §5). `autonomy` is the rung
 * the PROTOTYPE runs at (A0 observe, A1 recommend, A2 acts on approval,
 * A3 acts and reports, A4 autonomous). None is A4. Where the rung differs by
 * segment, `autonomyBySegment` says so. `owner` is the persona accountable
 * for the agent. `claude` says whether the agent calls Claude at all.
 */
import type { Autonomy, Segment } from './types.js';

export type AgentDef = {
  id: string; name: string; name_ar: string; title: string; title_ar: string;
  purpose: string; purpose_ar: string; autonomy: Autonomy; autonomyBySegment?: Partial<Record<Segment, Autonomy>>; owner: string;
  claude: 'no' | 'yes' | 'drafts';
  functions: string[]; superpower: string; impact: string; tools: string[]; reads: string[]; writes: string[]; decides: string;
};

export const AGENTS: AgentDef[] = [
  { id: 'raqib', name: 'Raqib', name_ar: 'رقيب', title: 'Data Health Monitor', title_ar: 'مراقب جودة البيانات',
    purpose: 'Runs the One Click eligibility check over the whole customer base nightly and on demand, classifies every fall-out into A/B/C/D, opens or updates one case per customer, and computes field-level data health.',
    purpose_ar: 'يشغّل فحص أهلية التمويل بنقرة واحدة على قاعدة العملاء ليلياً وعند الطلب، ويصنّف كل حالة سقوط إلى أ/ب/ج/د، ويفتح أو يحدّث حالة واحدة لكل عميل، ويحسب جودة البيانات على مستوى الحقول.',
    autonomy: 'A3', owner: 'head', claude: 'no',
    functions: ['Load every customer and run the twenty-reason check against the active policy version', 'Diff with the previous run: new fall-outs, cures, reasons added or cleared', 'Open, update or close one remediation case per customer, classed A/B/C/D', 'Compute data-health metrics: expiries, salary gaps, employer gaps, consents, contactability'],
    superpower: 'Turns 2,400 records into the exact list of what blocks each customer, every night, in seconds.',
    impact: 'The 65% who fall out stop being a percentage and become named, classed, actionable cases.',
    tools: ['qualify', 'classify', 'data_health'], reads: ['customers', 'identity_documents', 'employment', 'salary_credits', 'accounts', 'finance_facilities', 'cards', 'standing_orders', 'cheques_returned', 'cautionary_notes'], writes: ['cases', 'case_reasons', 'preapproval_runs', 'preapproval_results'], decides: 'Nobody: it opens cases and reports. It never contacts anyone.' },
  { id: 'munadi', name: 'Munadi', name_ar: 'منادي', title: 'Customer Outreach Officer', title_ar: 'مسؤول التواصل مع العملاء',
    purpose: 'Chooses the channel, composes the request or reminder from the approved bilingual template, schedules it inside the policy window, sends it through Hami, and records delivery.',
    purpose_ar: 'يختار القناة، ويصوغ الطلب أو التذكير من القالب المعتمد باللغتين، ويجدوله ضمن نافذة السياسة، ويرسله عبر حامي، ويسجّل التسليم.',
    autonomy: 'A3', autonomyBySegment: { MASS: 'A3', HIGH_VALUE: 'A3', HNWI: 'A2', VVIP: 'A1' }, owner: 'ops', claude: 'drafts',
    functions: ['Pick the next permitted channel in the segment order (one channel per attempt)', 'Render the approved template in the customer\'s language for that channel', 'Schedule inside the service window and outside quiet periods', 'Draft the RM brief (HNWI, VVIP) and non-template replies for a person to review'],
    superpower: 'Asks for exactly one thing, on the channel the customer uses, at an hour the policy allows.',
    impact: 'A request the customer can act on in one tap — so the reminder sequence stays short.',
    tools: ['templates', 'calendar', 'channels'], reads: ['cases', 'contacts', 'consents', 'templates'], writes: ['outreach_messages', 'tasks'], decides: 'Nobody for templated service messages inside policy (Mass, High Value); the RM approves (HNWI) or sends (VVIP).' },
  { id: 'mustaqbil', name: 'Mustaqbil', name_ar: 'مستقبِل', title: 'Inbound Triage Officer', title_ar: 'مسؤول فرز الوارد',
    purpose: 'Reads every inbound e-mail, in-app reply and uploaded file; classifies it (document, question, dispute, opt-out, hardship, complaint, out-of-office, unrelated); extracts attachments; routes.',
    purpose_ar: 'يقرأ كل بريد وارد ورد عبر التطبيق وملف محمّل؛ ويصنّفه (وثيقة، سؤال، اعتراض، إلغاء اشتراك، عسر، شكوى، خارج المكتب، غير ذي صلة)؛ ويستخرج المرفقات؛ ويوجّه.',
    autonomy: 'A3', owner: 'ops', claude: 'yes',
    functions: ['Match the message to the customer and the case (in-app always; e-mail by reference token or sender address)', 'Classify the text with Claude, or with the keyword fallback labelled Offline', 'Hand documents to Fahis, questions to Munadi, opt-outs and hardship to Hami and a person', 'Park unmatched mail in the unmatched inbox'],
    superpower: 'Reads a reply in Arabic or English and knows whether it is a document, a question or a cry for help.',
    impact: 'No inbox is read by a person unless a person is needed.',
    tools: ['classify', 'match'], reads: ['inbound_messages', 'contacts', 'cases'], writes: ['inbound_messages', 'documents', 'tasks'], decides: 'Nobody for classification and routing; hardship, complaint and dispute always go to a person.' },
  { id: 'fahis', name: 'Fahis', name_ar: 'فاحص', title: 'Document Examiner', title_ar: 'فاحص الوثائق',
    purpose: 'Extracts fields from QID, passport, salary certificate, HR letter, liability letter and bank statement; verifies expiry, name match, number match, MRZ check digits, salary against credits; assigns confidence and assurance; proposes the record update.',
    purpose_ar: 'يستخرج الحقول من البطاقة الشخصية وجواز السفر وشهادة الراتب وخطاب الموارد البشرية وخطاب الالتزامات وكشف الحساب؛ ويتحقق من الصلاحية وتطابق الاسم والرقم وأرقام التحقق؛ ويحدد الثقة ومستوى التأكيد؛ ويقترح تحديث السجل.',
    autonomy: 'A1', owner: 'ops', claude: 'yes',
    functions: ['Read the image with Claude vision (or the specimen\'s embedded fields when Offline)', 'Verify: expiry after today, name within tolerance, number equals the record, MRZ check digits (passports), certificate salary against credits', 'Assign per-field confidence and the evidence assurance level', 'Propose the before/after update for the checker'],
    superpower: 'Turns a photo into a verified, field-by-field proposal with its confidence, in seconds.',
    impact: 'The checker reviews a comparison, not a photo; a different person\'s document never reaches the record.',
    tools: ['vision', 'verify', 'mrz'], reads: ['documents', 'identity_documents', 'employment', 'salary_credits'], writes: ['documents', 'proposed_updates'], decides: 'Nobody: the checker decides every update.' },
  { id: 'muhaddith', name: 'Muhaddith', name_ar: 'محدِّث', title: 'Record Updater', title_ar: 'محدِّث السجلات',
    purpose: 'Applies approved updates to the customer record through the core connector; writes the before/after; triggers re-qualification.',
    purpose_ar: 'يطبّق التحديثات المعتمدة على سجل العميل عبر موصل النظام الأساسي؛ ويسجّل القيمة قبل وبعد؛ ويطلق إعادة التأهيل.',
    autonomy: 'A2', owner: 'supervisor', claude: 'no',
    functions: ['Apply an approved proposal field by field through the connector', 'Record before and after values on the trail', 'Log the core-banking call as the real API would see it', 'Ask Muahil to re-qualify'],
    superpower: 'The only agent that writes to the bank\'s record — and only with a checker\'s approval behind it.',
    impact: 'Every record change is traceable to a document, a proposal and a named approver.',
    tools: ['connector'], reads: ['proposed_updates'], writes: ['core.identity_documents', 'core.employment', 'core.contacts', 'core.standing_orders', 'core.customers', 'core.accounts'], decides: 'Nobody: it acts only on an approved proposal.' },
  { id: 'muwathiq', name: 'Muwathiq', name_ar: 'موثِّق', title: 'Employer Verifier', title_ar: 'موثِّق جهات العمل',
    purpose: 'Builds the employer approval pack (CR, WPS, sector, headcount, QIB-salaried staff, finance history) against the POL-03 criteria and recommends.',
    purpose_ar: 'يبني ملف اعتماد جهة العمل (السجل التجاري، حماية الأجور، القطاع، عدد الموظفين، موظفو المصرف، تاريخ التمويل) وفق معايير السياسة ويوصي.',
    autonomy: 'A1', owner: 'credit', claude: 'drafts',
    functions: ['Check each POL-03 criterion against the register', 'Count the QIB-salaried customers an approval would unblock', 'Draft the recommendation narrative for Credit Policy (Claude, reviewed)', 'Track the review SLA'],
    superpower: 'Shows Credit Policy that one decision re-qualifies fourteen customers.',
    impact: 'Employer approvals are decided on evidence, in days, with the leverage visible.',
    tools: ['register', 'criteria'], reads: ['employers', 'employment', 'customers'], writes: ['employer_reviews'], decides: 'Nobody: Credit Policy decides.' },
  { id: 'muahil', name: 'Muahil', name_ar: 'مؤهِّل', title: 'Re-qualification Officer', title_ar: 'مسؤول إعادة التأهيل',
    purpose: 'Re-runs the eligibility check after any record change, computes the eligible amount under POL-04, and hands eligible customers to One Click Finance (simulated push).',
    purpose_ar: 'يعيد تشغيل فحص الأهلية بعد أي تغيير في السجل، ويحسب المبلغ المؤهل وفق السياسة، ويحيل العملاء المؤهلين إلى التمويل بنقرة واحدة (إشعار محاكى).',
    autonomy: 'A3', autonomyBySegment: { MASS: 'A3', HIGH_VALUE: 'A3', HNWI: 'A2', VVIP: 'A1' }, owner: 'head', claude: 'no',
    functions: ['Re-qualify one customer on an event, or all customers of an employer on its approval', 'Compute the eligible amount and tenor', 'Hand off to One Click through Hami\'s consent and suppression check', 'Update the case with the remaining reasons when still not eligible'],
    superpower: 'Closes the loop: the day the record is fixed, the offer is back.',
    impact: 'Cured customers receive the offer the same day, not at the next monthly review.',
    tools: ['qualify', 'oneclick'], reads: ['customers', 'preapproval_results', 'consents'], writes: ['preapproval_results', 'cases', 'outreach_messages'], decides: 'Nobody for Mass and High Value; the RM approves the hand-off (HNWI) or sends it (VVIP). The bank\'s model remains the credit decision.' },
  { id: 'munabbih', name: 'Munabbih', name_ar: 'منبِّه', title: 'Early-Arrears Reminder', title_ar: 'منبِّه المتأخرات المبكرة',
    purpose: 'Sends pre-delinquency payment reminders inside the collections policy (POL-05), one action per day, and hands over at the DPD boundary.',
    purpose_ar: 'يرسل تذكيرات السداد قبل التعثر ضمن سياسة التحصيل، بإجراء واحد في اليوم، ويسلّم الحالة عند حد أيام التأخر.',
    autonomy: 'A3', autonomyBySegment: { MASS: 'A3', HIGH_VALUE: 'A3', HNWI: 'A2', VVIP: 'A2' }, owner: 'collections', claude: 'no',
    functions: ['Day 1 push, day 4 e-mail or SMS, day 7 call task, day 10 letter — neutral wording', 'One action per day across POL-01 and POL-05 together', 'Hand off to Collections at the DPD limit and stop', 'Start the cooling period on payment'],
    superpower: 'Reminds early and politely, then steps out of the way of Collections.',
    impact: 'Fewer customers cross into delinquency; the offer is never sent to someone in arrears.',
    tools: ['cadence', 'calendar'], reads: ['finance_facilities', 'cards'], writes: ['outreach_messages', 'tasks', 'cases'], decides: 'Nobody within DPD 1–30 for Mass and High Value; the RM approves for HNWI and VVIP; Collections owns everything past the boundary.' },
  { id: 'hami', name: 'Hami', name_ar: 'حامي', title: 'Policy Guard', title_ar: 'حارس السياسات',
    purpose: 'Checks every outbound action against POL-01/05/07/09 before it leaves: window, quiet period, caps, consent, suppression, opt-out, DNC, segment channel rules; blocks and explains.',
    purpose_ar: 'يفحص كل إجراء صادر وفق سياسات التواصل والسلوك والخصوصية والتقويم قبل خروجه: النافذة، الفترات الهادئة، الحدود، الموافقة، الحظر، إلغاء الاشتراك، قائمة عدم التواصل، قواعد قنوات الشريحة؛ ويحجب ويوضح.',
    autonomy: 'A3', owner: 'compliance', claude: 'no',
    functions: ['Check the three suppression lists in order: DNC, marketing opt-out, channel opt-out', 'Check the window, the quiet periods and the contact caps', 'Check the segment channel rule and RM-approval requirement', 'Block with the clause, or allow and stamp the policy version'],
    superpower: 'Says no with the clause number, before the message leaves.',
    impact: 'No message to an opted-out customer, no offer to someone in arrears, no SMS to a Private Banking client.',
    tools: ['guard'], reads: ['consents', 'policies', 'calendar_days', 'outreach_messages'], writes: ['outreach_messages (block)', 'trail'], decides: 'It blocks and reports; it never sends.' },
  { id: 'dalil', name: 'Dalil', name_ar: 'دليل', title: 'Co-pilot', title_ar: 'المساعد الذكي',
    purpose: 'Answers any question about the data or the actions from the same database the screens use, cites the policy clause, navigates, and prepares actions for the person to confirm.',
    purpose_ar: 'يجيب عن أي سؤال حول البيانات أو الإجراءات من قاعدة البيانات نفسها التي تقرأ منها الشاشات، ويستشهد ببند السياسة، ويتنقل، ويُعدّ الإجراءات ليؤكدها الشخص.',
    autonomy: 'A2', owner: 'head', claude: 'yes',
    functions: ['Answer from the data tools inside the persona\'s scope', 'Explain why a customer is not eligible, rule by rule', 'Cite the policy clause from search_policy', 'Prepare an action for Confirm; never write on its own'],
    superpower: 'Turns "why is this customer not eligible?" into the rule that failed, the clause, and the action that cures it.',
    impact: 'The product owner asks the platform instead of asking for an extract.',
    tools: ['search_policy', 'data_health', 'find_customers', 'customer_360', 'explain_eligibility', 'cases_waiting', 'case_summary', 'outreach_history', 'document_status', 'policy_params', 'employer_review', 'propose_action', 'open_screen'], reads: ['everything in scope'], writes: [], decides: 'The person confirms every action.' },
];

export const AGENT = Object.fromEntries(AGENTS.map((a) => [a.id, a])) as Record<string, AgentDef>;
export const agentAutonomy = (id: string, segment?: Segment): Autonomy => { const a = AGENT[id]; return (segment && a?.autonomyBySegment?.[segment]) ?? a?.autonomy ?? 'A1'; };
