/**
 * The twenty fall-out reasons, in QIB's rank order (rank 1 = most frequent).
 * Each carries its class, the workflow that handles it, the evidence that
 * cures it and the re-check rule. Definitions are design defaults and every
 * threshold is a policy parameter (see policy.ts); QIB's own definitions
 * replace the text, not the code.
 */
import type { CaseClass, ReasonCode } from './types.js';

export type ReasonDef = {
  code: ReasonCode; rank: number; label: string; label_ar: string; qib: string; cls: CaseClass;
  workflow: string; definition: string; evidence: string; recheck: string; contact: string;
  /** Weight used by the synthetic generator (share of fall-out incidences). */
  weight: number;
};

export const REASONS: ReasonDef[] = [
  { code: 'R01', rank: 1, qib: 'MISSING/LOW SALARY IN ANY OF THE LAST 6 MONTHS', label: 'Salary missing or low', label_ar: 'راتب مفقود أو منخفض', cls: 'A', workflow: 'WF-04', weight: 22,
    definition: 'No salary credit in a calendar month inside the window, or a credit below the low-salary threshold of the trailing median.',
    evidence: 'Salary certificate (≤ 30 days), HR letter for an explained gap, or a salary-transfer instruction.', recheck: 'On document; monthly on salary history.', contact: 'Yes — service message, within the segment policy.' },
  { code: 'R02', rank: 2, qib: 'EMPLOYER UNAPPROVED OR MISSING', label: 'Employer missing or unapproved', label_ar: 'جهة العمل غير مسجلة أو غير معتمدة', cls: 'A', workflow: 'WF-05', weight: 15,
    definition: 'Missing: no employer on the record. Unapproved: the employer is not on the approved list (bank action).',
    evidence: 'Salary certificate naming the employer; Credit Policy decision on the employer.', recheck: 'On the employer decision — one approval re-qualifies every employee.', contact: 'Missing: yes. Unapproved: after the bank decides.' },
  { code: 'R03', rank: 3, qib: 'EXCEEDS PERMISSIBLE EXPOSURE TO FINANCING AMOUNT', label: 'Exposure over the limit', label_ar: 'تجاوز الحد المسموح للتمويل', cls: 'B', workflow: 'WF-11', weight: 11,
    definition: 'Existing repayable exposure at or above the nationality cap, or DBR capacity at or below zero after existing obligations (evaluated after R04).',
    evidence: 'Nothing from the customer: a maturity or a prepayment.', recheck: 'At each instalment date; on prepayment.', contact: 'No, unless exposureInfoMessage is on.' },
  { code: 'R04', rank: 4, qib: 'STANDING ORDERS EXCEED LIMITS', label: 'Standing orders too high', label_ar: 'أوامر الدفع الدائمة تتجاوز الحد', cls: 'A', workflow: 'WF-07', weight: 8,
    definition: 'Recurring standing orders to financial institutions counted as obligations exceed the standing-order limit (share of salary).',
    evidence: 'Customer classification of each order; liability letter for other-bank finance.', recheck: 'On declaration.', contact: 'Yes — in-app list to classify.' },
  { code: 'R05', rank: 5, qib: 'HAS CAUTIONARY NOTE', label: 'Cautionary note', label_ar: 'ملاحظة تحذيرية', cls: 'B', workflow: 'WF-10', weight: 6,
    definition: 'Any active cautionary note. Compliance clears or reclassifies it; KYC-expired and salary-stopped notes can be reclassified to WF-02/03/04.',
    evidence: 'Compliance clearance; discharge certificate; delisting.', recheck: 'On note lift.', contact: 'No, until Compliance acts.' },
  { code: 'R06', rank: 6, qib: 'PASSPORT EXPIRED', label: 'Passport expired', label_ar: 'جواز السفر منتهي', cls: 'A', workflow: 'WF-03', weight: 5.5,
    definition: 'Passport expiry before today (residents). A passport expiring within the watch window opens a pre-expiry case, which is a trigger, not a reason.',
    evidence: 'New passport data page.', recheck: 'On document.', contact: 'Yes — notices T0, +30, +60; restriction proposal at +90.' },
  { code: 'R07', rank: 7, qib: 'QID EXPIRED', label: 'QID expired', label_ar: 'البطاقة الشخصية منتهية', cls: 'A', workflow: 'WF-02', weight: 5,
    definition: 'QID expiry before today. The QID number must match the record; a different number is a flag, not an update.',
    evidence: 'New QID, front and back.', recheck: 'On document.', contact: 'Yes — notices T0, +30, +60; restriction proposal at +90.' },
  { code: 'R08', rank: 8, qib: 'DOES NOT HAVE CURRENT ACCOUNT', label: 'No current account', label_ar: 'لا يوجد حساب جارٍ', cls: 'A', workflow: 'WF-08', weight: 4.5,
    definition: 'The customer holds only savings or deposit accounts; One Click disburses into a current account.',
    evidence: 'Account opened (checker-approved) or a dormant current account reactivated.', recheck: 'On account event; on consent.', contact: 'With marketing consent: in-app offer. Without: parked (Mass) or RM task.' },
  { code: 'R09', rank: 9, qib: 'FAILED DUE TO RISK MODEL CUT OFF', label: 'Risk model cut-off', label_ar: 'دون حد نموذج المخاطر', cls: 'C', workflow: 'WF-14', weight: 4,
    definition: 'The bank model score is below the cut-off. Jahiz holds the score as an opaque input.', evidence: 'None from the customer.', recheck: 'Monthly re-score.', contact: 'No.' },
  { code: 'R10', rank: 10, qib: 'DOES NOT MEET AGE CRITERIA', label: 'Age criteria', label_ar: 'لا يستوفي شرط العمر', cls: 'C', workflow: 'WF-14', weight: 3.5,
    definition: 'Below the minimum age, or too close to the age limit for the minimum tenor (measured at maturity).', evidence: 'None.', recheck: 'On the birthday that changes the answer.', contact: 'No.' },
  { code: 'R11', rank: 11, qib: 'RESTRICTED NATIONALITY', label: 'Restricted nationality', label_ar: 'جنسية مقيدة', cls: 'C', workflow: 'WF-14', weight: 3,
    definition: 'Nationality on the restricted list maintained by Compliance (illustrative list in the demo).', evidence: 'None.', recheck: 'On list change.', contact: 'No.' },
  { code: 'R12', rank: 12, qib: 'ELIGIBLE IS BELOW MINIMUM OF 5K QAR', label: 'Eligible below the minimum', label_ar: 'المبلغ المؤهل دون الحد الأدنى', cls: 'C', workflow: 'WF-14', weight: 2.5,
    definition: 'The computed eligible amount is below the One Click minimum.', evidence: 'None from the customer.', recheck: 'Monthly.', contact: 'No.' },
  { code: 'R13', rank: 13, qib: "CUSTOMER STATUS IN DB IS NOT 'NORMAL'", label: 'Status not Normal', label_ar: 'حالة العميل غير طبيعية', cls: 'A', workflow: 'WF-09', weight: 2.2,
    definition: 'Dormant → reactivation request; blocked for KYC → WF-02/03; blocked for salary → WF-04; blocked for delinquency → class D; frozen, deceased or closed → Compliance, no contact.',
    evidence: 'Depends on the sub-status.', recheck: 'On status change.', contact: 'Dormant and KYC blocks: yes. Frozen, deceased, closed: no.' },
  { code: 'R14', rank: 14, qib: 'HAS FINANCE PRODUCTS WHICH HAVE IRREGULAR PAYMENTS OR SCHEDULES', label: 'Irregular payments', label_ar: 'مدفوعات غير منتظمة', cls: 'D', workflow: 'WF-13', weight: 2,
    definition: 'Late instalments in the last six months at or above the threshold, or a restructured or deferred schedule.', evidence: 'Six regular instalments.', recheck: 'Monthly.', contact: 'Payment reminders only, under the collections policy.' },
  { code: 'R15', rank: 15, qib: 'FINANCE IS DAYS PAST DUE', label: 'Finance past due', label_ar: 'تمويل متأخر السداد', cls: 'D', workflow: 'WF-12', weight: 1.6,
    definition: 'Days past due above zero on any finance facility.', evidence: 'Payment, then the cooling period.', recheck: 'Daily while past due.', contact: 'Early-arrears reminders inside the collections policy; hand-off at the DPD limit.' },
  { code: 'R16', rank: 16, qib: 'CREDIT CARD IS DAYS PAST DUE', label: 'Card past due', label_ar: 'بطاقة ائتمان متأخرة السداد', cls: 'D', workflow: 'WF-12', weight: 1.3,
    definition: 'Days past due above zero on any card.', evidence: 'Payment, then the cooling period.', recheck: 'Daily while past due.', contact: 'As R15.' },
  { code: 'R17', rank: 17, qib: 'HAS RETURNED CHEQUES', label: 'Returned cheques', label_ar: 'شيكات مرتجعة', cls: 'D', workflow: 'WF-13', weight: 1,
    definition: 'A returned cheque inside the lookback window (the bureau keeps the record three years from settlement).', evidence: 'Settlement and bureau ageing.', recheck: 'On settlement; at ageing.', contact: 'No.' },
  { code: 'R18', rank: 18, qib: 'INELIGIBLE CUSTOMER SEGMENT', label: 'Ineligible segment', label_ar: 'شريحة غير مؤهلة', cls: 'C', workflow: 'WF-14', weight: 0.8,
    definition: 'Staff, minors, non-residents, corporate-linked or other segments QIB excludes.', evidence: 'None.', recheck: 'On segment change.', contact: 'No.' },
  { code: 'R19', rank: 19, qib: 'DOES NOT MEET QCB/QIB RATING', label: 'QCB / QIB rating', label_ar: 'لا يستوفي التصنيف', cls: 'C', workflow: 'WF-14', weight: 0.6,
    definition: 'Internal rating below the threshold.', evidence: 'None.', recheck: 'Monthly re-score.', contact: 'No.' },
  { code: 'R20', rank: 20, qib: 'AUTO_IJARA_CUT_OFF', label: 'Auto Ijara cut-off', label_ar: 'دون حد إجارة السيارات', cls: 'C', workflow: 'WF-14', weight: 0.5,
    definition: 'Product-specific cut-off for the vehicle-finance offer; a customer failing only R20 stays eligible for personal finance.', evidence: 'None.', recheck: 'Monthly.', contact: 'No.' },
];

export const REASON = Object.fromEntries(REASONS.map((r) => [r.code, r])) as Record<ReasonCode, ReasonDef>;

/** Class precedence for a case that carries several reasons: D > C > A > B (A and B run in parallel). */
export function classOf(reasons: ReasonCode[]): CaseClass | null {
  const set = new Set(reasons.map((r) => REASON[r].cls));
  if (set.has('D')) return 'D';
  if (set.has('C')) return 'C';
  if (set.has('A')) return 'A';
  if (set.has('B')) return 'B';
  return null;
}

export const CLASS_LABEL: Record<CaseClass, string> = { A: 'Ask the customer', B: 'The bank must act', C: 'Not eligible by policy', D: 'Collections boundary' };
export const CLASS_LABEL_AR: Record<CaseClass, string> = { A: 'اطلب من العميل', B: 'إجراء من البنك', C: 'غير مؤهل بحسب السياسة', D: 'حدود التحصيل' };
