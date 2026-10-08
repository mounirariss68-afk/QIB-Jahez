/**
 * Data health (DESIGN §9.4): field-level metrics over the customer base,
 * computed in one place from the facts and the qualification results.
 */
import { addDays } from './eligibility.js';
import { REASONS } from './reasons.js';
import type { CaseClass, CustomerFacts, ReasonCode, Segment } from './types.js';
import { SEGMENTS } from './types.js';

export type HealthRow = { customer: CustomerFacts; eligible: boolean; reasons: ReasonCode[]; cls: CaseClass | null; amount: number; marketingConsent: boolean; appRegistered: boolean; dnc: boolean };

export type DataHealth = {
  asOf: string; customers: number; eligible: number; eligibleRate: number; fallouts: number;
  bySegment: { segment: Segment; customers: number; eligible: number; rate: number }[];
  byClass: { cls: CaseClass; cases: number; share: number }[];
  byReason: { code: ReasonCode; rank: number; label: string; incidences: number; share: number; cls: CaseClass }[];
  multiReason: { one: number; two: number; threePlus: number };
  fields: { field: string; label: string; healthy: number; total: number; pct: number; note: string }[];
  expiriesAhead: { qid30: number; qid90: number; passport30: number; passport90: number };
  contactability: { marketingConsent: number; appRegistered: number; dnc: number; contactable: number };
  curable: { classA: number; classB: number; amountA: number };
  employers: { id: string; customers: number; status: string }[];
};

export function dataHealth(rows: HealthRow[], asOf: string, employerStatus: Record<string, string>): DataHealth {
  const n = rows.length;
  const eligible = rows.filter((r) => r.eligible).length;
  const fall = rows.filter((r) => !r.eligible);
  const bySegment = SEGMENTS.map((segment) => { const xs = rows.filter((r) => r.customer.segment === segment); const e = xs.filter((r) => r.eligible).length; return { segment, customers: xs.length, eligible: e, rate: xs.length ? Math.round((1000 * e) / xs.length) / 10 : 0 }; });
  const byClass = (['A', 'B', 'C', 'D'] as CaseClass[]).map((cls) => { const c = fall.filter((r) => r.cls === cls).length; return { cls, cases: c, share: fall.length ? Math.round((1000 * c) / fall.length) / 10 : 0 }; });
  const incid = fall.reduce((s, r) => s + r.reasons.length, 0);
  const byReason = REASONS.map((d) => { const c = fall.filter((r) => r.reasons.includes(d.code)).length; return { code: d.code, rank: d.rank, label: d.label, incidences: c, share: incid ? Math.round((1000 * c) / incid) / 10 : 0, cls: d.cls }; });
  const multiReason = { one: fall.filter((r) => r.reasons.length === 1).length, two: fall.filter((r) => r.reasons.length === 2).length, threePlus: fall.filter((r) => r.reasons.length >= 3).length };
  const pct = (h: number, t: number) => (t ? Math.round((1000 * h) / t) / 10 : 100);
  const residents = rows.filter((r) => !r.customer.isQatari).length;
  const fields = [
    { field: 'qid_expiry', label: 'QID valid', healthy: rows.filter((r) => r.customer.qidExpiry && r.customer.qidExpiry >= asOf).length, total: n, note: 'Expiry on or after today' },
    { field: 'passport_expiry', label: 'Passport valid (residents)', healthy: rows.filter((r) => !r.customer.isQatari && r.customer.passportExpiry && r.customer.passportExpiry >= asOf).length, total: residents, note: 'Residents only' },
    { field: 'employer', label: 'Employer recorded', healthy: rows.filter((r) => r.customer.employerId).length, total: n, note: 'Migration gap when missing' },
    { field: 'employer_approved', label: 'Employer approved', healthy: rows.filter((r) => r.customer.employerStatus === 'APPROVED').length, total: n, note: 'Approved list' },
    { field: 'salary_6m', label: 'Salary credited every month (6m)', healthy: rows.filter((r) => !r.reasons.includes('R01')).length, total: n, note: 'No missing or low month' },
    { field: 'current_account', label: 'Current account', healthy: rows.filter((r) => r.customer.hasCurrentAccount).length, total: n, note: 'Required for disbursement' },
    { field: 'status', label: 'Status Normal', healthy: rows.filter((r) => r.customer.status === 'NORMAL').length, total: n, note: 'Dormant, blocked, frozen otherwise' },
    { field: 'notes', label: 'No cautionary note', healthy: rows.filter((r) => !r.customer.notes.some((x) => !x.lifted)).length, total: n, note: 'Compliance queue otherwise' },
    { field: 'conduct', label: 'Payments regular, no DPD', healthy: rows.filter((r) => !r.reasons.some((x) => ['R14', 'R15', 'R16', 'R17'].includes(x))).length, total: n, note: 'Class D otherwise' },
    { field: 'marketing_consent', label: 'Marketing consent on file', healthy: rows.filter((r) => r.marketingConsent).length, total: n, note: 'Needed for offers (POL-07 §2.1)' },
    { field: 'app_registered', label: 'App registered', healthy: rows.filter((r) => r.appRegistered).length, total: n, note: 'Primary channel' },
  ].map((f) => ({ ...f, pct: pct(f.healthy, f.total) }));
  const within = (d: string | null, days: number) => !!d && d >= asOf && d <= addDays(asOf, days);
  const expiriesAhead = { qid30: rows.filter((r) => within(r.customer.qidExpiry, 30)).length, qid90: rows.filter((r) => within(r.customer.qidExpiry, 90)).length, passport30: rows.filter((r) => !r.customer.isQatari && within(r.customer.passportExpiry, 30)).length, passport90: rows.filter((r) => !r.customer.isQatari && within(r.customer.passportExpiry, 90)).length };
  const contactability = { marketingConsent: rows.filter((r) => r.marketingConsent).length, appRegistered: rows.filter((r) => r.appRegistered).length, dnc: rows.filter((r) => r.dnc).length, contactable: rows.filter((r) => !r.dnc && ['NORMAL', 'DORMANT', 'BLOCKED_KYC', 'BLOCKED_SALARY'].includes(r.customer.status)).length };
  const curable = { classA: fall.filter((r) => r.cls === 'A').length, classB: fall.filter((r) => r.cls === 'B').length, amountA: 0 };
  const empMap = new Map<string, number>();
  for (const r of fall) if (r.reasons.includes('R02') && r.customer.employerId) empMap.set(r.customer.employerId, (empMap.get(r.customer.employerId) ?? 0) + 1);
  const employers = [...empMap.entries()].map(([id, customers]) => ({ id, customers, status: employerStatus[id] ?? 'UNKNOWN' })).sort((a, b) => b.customers - a.customers).slice(0, 12);
  return { asOf, customers: n, eligible, eligibleRate: n ? Math.round((1000 * eligible) / n) / 10 : 0, fallouts: fall.length, bySegment, byClass, byReason, multiReason, fields, expiriesAhead, contactability, curable, employers };
}
