/**
 * Personas and the authority matrix (DESIGN §8). Switching persona changes
 * the Inbox, the cases owned, what is approvable, which customers are visible
 * and what Dalil will do. Names are fictional. `propose_action` and every
 * screen button read `may()`; anything not granted is not shown.
 */
import type { CaseClass, Segment } from './types.js';

export type PersonaKey = 'head' | 'credit' | 'ops' | 'supervisor' | 'compliance' | 'rm' | 'collections' | 'steward';
export type Persona = {
  key: PersonaKey; name: string; name_ar: string; role: string; role_ar: string; initials: string;
  sees: string; owns: string[]; home: string; suggestions: string[]; suggestions_ar: string[];
  /** Data scope: which segments / classes / own book. */
  scope: { segments?: Segment[]; classes?: CaseClass[]; ownBook?: boolean; metricsOnly?: boolean };
  policyDomainsPropose: string[]; policyDomainsApprove: string[];
};

export const PERSONAS: Persona[] = [
  { key: 'head', name: 'Khalid Al-Mannai', name_ar: 'خالد المناعي', role: 'Head of Retail Credit & Digital Finance', role_ar: 'رئيس الائتمان الشخصي والتمويل الرقمي', initials: 'KM', sees: 'Everything', owns: ['raqib', 'muahil', 'dalil'], home: 'overview',
    suggestions: ['How many fall-outs are curable?', 'What changed since the last scan?', 'Which employers block the most customers?', 'What is waiting on me?'],
    suggestions_ar: ['كم عدد الحالات القابلة للمعالجة؟', 'ما الذي تغير منذ آخر فحص؟', 'أي جهات العمل تحجب أكبر عدد من العملاء؟', 'ما الذي ينتظرني؟'],
    scope: {}, policyDomainsPropose: ['*'], policyDomainsApprove: ['POL-01', 'POL-02', 'POL-03', 'POL-08', 'SEG', 'CH', 'DATA'] },
  { key: 'credit', name: 'Noora Al-Sulaiti', name_ar: 'نورة السليطي', role: 'Credit Policy Officer', role_ar: 'مسؤولة سياسة الائتمان', initials: 'NS', sees: 'All customers; the employer register', owns: ['muwathiq'], home: 'inbox',
    suggestions: ['Employer reviews waiting on me', 'Explain eligibility for DEMO-C-00003', 'How is the eligible amount computed?', 'Which customers are over the exposure cap?'],
    suggestions_ar: ['مراجعات جهات العمل التي تنتظرني', 'اشرح أهلية العميل DEMO-C-00003', 'كيف يُحتسب المبلغ المؤهل؟', 'من هم العملاء فوق حد التعرض؟'],
    scope: {}, policyDomainsPropose: ['POL-03', 'POL-04', 'REF'], policyDomainsApprove: ['POL-04', 'REF'] },
  { key: 'ops', name: 'Yousef Haddad', name_ar: 'يوسف حداد', role: 'Remediation Operations Officer (maker)', role_ar: 'مسؤول عمليات المعالجة (المُعدّ)', initials: 'YH', sees: 'Mass and High Value cases', owns: ['munadi', 'mustaqbil', 'fahis'], home: 'inbox',
    suggestions: ['What is waiting on me?', 'Which cases have unanswered notices?', 'Send the reminder for DEMO-CASE-00001', 'Show me the documents queue'],
    suggestions_ar: ['ما الذي ينتظرني؟', 'أي الحالات لم يُرد على إشعاراتها؟', 'أرسل التذكير للحالة DEMO-CASE-00001', 'أظهر قائمة الوثائق'],
    scope: { segments: ['MASS', 'HIGH_VALUE'] }, policyDomainsPropose: [], policyDomainsApprove: [] },
  { key: 'supervisor', name: 'Maryam Al-Kuwari', name_ar: 'مريم الكواري', role: 'Operations Supervisor (checker)', role_ar: 'مشرفة العمليات (المدققة)', initials: 'MK', sees: 'All Mass and High Value cases; the documents queue', owns: ['muhaddith'], home: 'inbox',
    suggestions: ['Updates waiting for my approval', 'Restriction proposals waiting on me', 'Propose a shorter Mass reminder interval', 'What is the random audit rate?'],
    suggestions_ar: ['التحديثات التي تنتظر اعتمادي', 'مقترحات التقييد التي تنتظرني', 'اقترح فاصلاً أقصر لتذكيرات الشريحة العامة', 'ما نسبة التدقيق العشوائي؟'],
    scope: { segments: ['MASS', 'HIGH_VALUE'] }, policyDomainsPropose: ['POL-01', 'POL-02', 'POL-06'], policyDomainsApprove: ['POL-06'] },
  { key: 'compliance', name: 'Fatima Al-Thani', name_ar: 'فاطمة آل ثاني', role: 'Compliance & Data Protection Officer', role_ar: 'مسؤولة الامتثال وحماية البيانات', initials: 'FT', sees: 'All; the audit trail; consents', owns: ['hami'], home: 'inbox',
    suggestions: ['Who opted out this week?', 'Cautionary notes waiting on me', 'What did Hami block today and why?', 'Show the do-not-contact list'],
    suggestions_ar: ['من ألغى اشتراكه هذا الأسبوع؟', 'الملاحظات التحذيرية التي تنتظرني', 'ما الذي حجبه حامي اليوم ولماذا؟', 'أظهر قائمة عدم التواصل'],
    scope: {}, policyDomainsPropose: ['POL-05', 'POL-07', 'POL-09', 'POL-10', 'REF'], policyDomainsApprove: ['POL-05', 'POL-07', 'POL-09', 'POL-10'] },
  { key: 'rm', name: 'Abdulla Al-Emadi', name_ar: 'عبدالله العمادي', role: 'Relationship Manager (Tamayuz / Private Banking)', role_ar: 'مدير علاقات (تميّز / الخدمات المصرفية الخاصة)', initials: 'AE', sees: 'Own HNWI and VVIP clients only', owns: [], home: 'inbox',
    suggestions: ['Which of my clients have an expired QID?', 'Prepare the brief for my client with the expiring passport', 'Hand-offs waiting for my approval', 'Why is one of my clients suppressed?'],
    suggestions_ar: ['أي من عملائي انتهت بطاقته الشخصية؟', 'أعدّ الملخص لعميلي الذي ينتهي جواز سفره', 'الإحالات التي تنتظر اعتمادي', 'لماذا أحد عملائي محجوب؟'],
    scope: { segments: ['HNWI', 'VVIP'], ownBook: true }, policyDomainsPropose: [], policyDomainsApprove: [] },
  { key: 'collections', name: 'Hamad Al-Marri', name_ar: 'حمد المري', role: 'Collections Officer', role_ar: 'مسؤول التحصيل', initials: 'HM', sees: 'Class D cases', owns: ['munabbih'], home: 'inbox',
    suggestions: ['Hand-offs waiting on me', 'Which customers are in early arrears?', 'What is the collections hand-off DPD?', 'Reminders sent today'],
    suggestions_ar: ['حالات التسليم التي تنتظرني', 'من هم العملاء في المتأخرات المبكرة؟', 'ما حد التسليم إلى التحصيل؟', 'التذكيرات المرسلة اليوم'],
    scope: { classes: ['D'] }, policyDomainsPropose: [], policyDomainsApprove: [] },
  { key: 'steward', name: 'Sara Rahimi', name_ar: 'سارة رحيمي', role: 'Data Steward (CDO office)', role_ar: 'مسؤولة البيانات (مكتب رئيس البيانات)', initials: 'SR', sees: 'Metrics and field-level rules; drill-downs show DEMO ids only', owns: [], home: 'health',
    suggestions: ['Which fields drive most fall-outs?', 'How many QIDs expire in the next 90 days?', 'What is the low-salary threshold?', 'Trend of eligible rate'],
    suggestions_ar: ['أي الحقول تسبب أكبر عدد من حالات السقوط؟', 'كم بطاقة شخصية تنتهي خلال 90 يوماً؟', 'ما حد الراتب المنخفض؟', 'اتجاه نسبة المؤهلين'],
    scope: { metricsOnly: true }, policyDomainsPropose: ['POL-03'], policyDomainsApprove: [] },
];
export const PERSONA = Object.fromEntries(PERSONAS.map((p) => [p.key, p])) as Record<PersonaKey, Persona>;

export type ActionType =
  | 'SEND_REQUEST' | 'SEND_REMINDER' | 'RESCHEDULE' | 'PAUSE_CASE' | 'RESUME_CASE' | 'ESCALATE_TO_RM' | 'PROPOSE_UPDATE' | 'APPROVE_UPDATE' | 'REJECT_UPDATE'
  | 'ACCEPT_EXPLAINED_GAP' | 'OPEN_EMPLOYER_REVIEW' | 'DECIDE_EMPLOYER' | 'RERUN_QUALIFICATION' | 'APPROVE_HANDOFF' | 'PROPOSE_RESTRICTION' | 'DECIDE_RESTRICTION'
  | 'CLOSE_UNRESPONSIVE' | 'CLEAR_CAUTIONARY_NOTE' | 'RECLASSIFY_CAUTIONARY_NOTE' | 'ADD_DNC' | 'REMOVE_DNC' | 'COLLECTIONS_CADENCE_EXCEPTION'
  | 'PROPOSE_POLICY_CHANGE' | 'APPROVE_POLICY_CHANGE' | 'RESET_DEMO' | 'RUN_SCENARIO' | 'RUN_SCAN' | 'ADVANCE_CLOCK';

export type Grant = { all?: true; segments?: Segment[]; classes?: CaseClass[]; ownBook?: true; maker?: true; domains?: string[] };
const ALL: Grant = { all: true };
const MHV: Grant = { segments: ['MASS', 'HIGH_VALUE'] };
const RM: Grant = { ownBook: true };
const D: Grant = { classes: ['D'] };

/** Action → persona → grant. Anything absent is not granted. */
export const AUTHORITY: Record<ActionType, Partial<Record<PersonaKey, Grant>>> = {
  SEND_REQUEST: { head: ALL, ops: MHV, supervisor: ALL, rm: RM },
  SEND_REMINDER: { head: ALL, ops: MHV, supervisor: ALL, rm: RM },
  RESCHEDULE: { head: ALL, ops: ALL, supervisor: ALL, rm: RM, collections: D },
  PAUSE_CASE: { head: ALL, ops: ALL, supervisor: ALL, compliance: ALL, rm: RM, collections: D },
  RESUME_CASE: { head: ALL, ops: ALL, supervisor: ALL, compliance: ALL, rm: RM, collections: D },
  ESCALATE_TO_RM: { head: ALL, ops: ALL, supervisor: ALL },
  PROPOSE_UPDATE: { ops: { maker: true }, supervisor: { maker: true }, rm: { ownBook: true, maker: true } },
  APPROVE_UPDATE: { head: ALL, supervisor: ALL },
  REJECT_UPDATE: { head: ALL, supervisor: ALL },
  ACCEPT_EXPLAINED_GAP: { head: ALL, credit: { segments: ['HIGH_VALUE', 'HNWI', 'VVIP'] }, supervisor: { segments: ['MASS'] } },
  OPEN_EMPLOYER_REVIEW: { head: ALL, credit: ALL, ops: ALL, supervisor: ALL, rm: RM },
  DECIDE_EMPLOYER: { head: ALL, credit: ALL },
  RERUN_QUALIFICATION: { head: ALL, credit: ALL, ops: ALL, supervisor: ALL, rm: RM, collections: D },
  APPROVE_HANDOFF: { head: ALL, rm: RM },
  PROPOSE_RESTRICTION: { head: ALL, ops: ALL, supervisor: ALL, rm: RM },
  DECIDE_RESTRICTION: { head: { segments: ['VVIP'] }, supervisor: MHV, rm: { segments: ['HNWI'], ownBook: true } },
  CLOSE_UNRESPONSIVE: { head: ALL, supervisor: ALL, rm: RM },
  CLEAR_CAUTIONARY_NOTE: { compliance: ALL },
  RECLASSIFY_CAUTIONARY_NOTE: { compliance: ALL },
  ADD_DNC: { compliance: ALL },
  REMOVE_DNC: { compliance: ALL },
  COLLECTIONS_CADENCE_EXCEPTION: { collections: ALL },
  PROPOSE_POLICY_CHANGE: { head: { domains: ['*'] }, credit: { domains: ['POL-03', 'POL-04', 'REF'] }, supervisor: { domains: ['POL-01', 'POL-02', 'POL-06'] }, compliance: { domains: ['POL-05', 'POL-07', 'POL-09', 'POL-10', 'REF'] }, steward: { domains: ['POL-03'] } },
  APPROVE_POLICY_CHANGE: { head: { domains: ['POL-01', 'POL-02', 'POL-03', 'POL-08', 'SEG', 'CH', 'DATA'] }, credit: { domains: ['POL-04', 'REF'] }, supervisor: { domains: ['POL-06'] }, compliance: { domains: ['POL-05', 'POL-07', 'POL-09', 'POL-10'] } },
  RESET_DEMO: { head: ALL, credit: ALL, ops: ALL, supervisor: ALL, compliance: ALL, rm: ALL, collections: ALL, steward: ALL },
  RUN_SCENARIO: { head: ALL, credit: ALL, ops: ALL, supervisor: ALL, compliance: ALL, rm: ALL, collections: ALL, steward: ALL },
  RUN_SCAN: { head: ALL, credit: ALL, ops: ALL, supervisor: ALL, compliance: ALL, rm: ALL, collections: ALL, steward: ALL },
  ADVANCE_CLOCK: { head: ALL, credit: ALL, ops: ALL, supervisor: ALL, compliance: ALL, rm: ALL, collections: ALL, steward: ALL },
};

export type Subject = { segment?: Segment; cls?: CaseClass | null; rmId?: string | null; domain?: string };

/** May this persona perform this action on this subject? Returns the grant or null. */
export function may(persona: PersonaKey, action: ActionType, s: Subject = {}, personaRmId?: string | null): Grant | null {
  const g = AUTHORITY[action]?.[persona];
  if (!g) return null;
  if (g.all) return g;
  if (g.segments && s.segment && !g.segments.includes(s.segment)) return null;
  if (g.classes && s.cls !== undefined && s.cls !== null && !g.classes.includes(s.cls)) return null;
  if (g.ownBook && s.rmId !== undefined && personaRmId && s.rmId !== personaRmId) return null;
  if (g.domains && s.domain && !g.domains.includes('*') && !g.domains.includes(s.domain)) return null;
  return g;
}

/** The persona that approves a given domain's policy change. */
export function approverForDomain(domain: string): PersonaKey {
  for (const p of PERSONAS) if (p.policyDomainsApprove.includes(domain)) return p.key;
  return 'head';
}
/** Persona key for a policy approver code (HEAD | CREDIT | SUPERVISOR | COMPLIANCE | RM). */
export const personaForApprover = (code: string): PersonaKey => (({ HEAD: 'head', CREDIT: 'credit', SUPERVISOR: 'supervisor', COMPLIANCE: 'compliance', RM: 'rm', OPS: 'ops', COLLECTIONS: 'collections' } as Record<string, PersonaKey>)[code] ?? 'supervisor');
