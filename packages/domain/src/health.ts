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
  /** The share healthy of each field, per segment (null where the segment has no one the field applies to). */
  fieldsBySegment: { field: string; bySegment: Record<Segment, number | null> }[];
  /** QIDs and residents' passports expiring in each of the next six months (YYYY-MM). */
  expiriesByMonth: { month: string; qid: number; passport: number }[];
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
  // Each field: who it applies to, and when it is healthy. Computed over the base and over each segment.
  const FIELDS: { field: string; label: string; note: string; applies: (r: HealthRow) => boolean; ok: (r: HealthRow) => boolean }[] = [
    { field: 'qid_expiry', label: 'QID valid', note: 'Expiry on or after today', applies: () => true, ok: (r) => !!r.customer.qidExpiry && r.customer.qidExpiry >= asOf },
    { field: 'passport_expiry', label: 'Passport valid (residents)', note: 'Residents only', applies: (r) => !r.customer.isQatari, ok: (r) => !!r.customer.passportExpiry && r.customer.passportExpiry >= asOf },
    { field: 'employer', label: 'Employer recorded', note: 'Migration gap when missing', applies: () => true, ok: (r) => !!r.customer.employerId },
    { field: 'employer_approved', label: 'Employer approved', note: 'Approved list', applies: () => true, ok: (r) => r.customer.employerStatus === 'APPROVED' },
    { field: 'salary_6m', label: 'Salary credited every month (6m)', note: 'No missing or low month', applies: () => true, ok: (r) => !r.reasons.includes('R01') },
    { field: 'current_account', label: 'Current account', note: 'Required for disbursement', applies: () => true, ok: (r) => !!r.customer.hasCurrentAccount },
    { field: 'status', label: 'Status Normal', note: 'Dormant, blocked, frozen otherwise', applies: () => true, ok: (r) => r.customer.status === 'NORMAL' },
    { field: 'notes', label: 'No cautionary note', note: 'Compliance queue otherwise', applies: () => true, ok: (r) => !r.customer.notes.some((x) => !x.lifted) },
    { field: 'conduct', label: 'Payments regular, no DPD', note: 'Class D otherwise', applies: () => true, ok: (r) => !r.reasons.some((x) => ['R14', 'R15', 'R16', 'R17'].includes(x)) },
    { field: 'marketing_consent', label: 'Marketing consent on file', note: 'Needed for offers (POL-07 §2.1)', applies: () => true, ok: (r) => r.marketingConsent },
    { field: 'app_registered', label: 'App registered', note: 'Primary channel', applies: () => true, ok: (r) => r.appRegistered },
  ];
  const fields = FIELDS.map((f) => { const xs = rows.filter(f.applies); const healthy = xs.filter(f.ok).length; return { field: f.field, label: f.label, healthy, total: xs.length, note: f.note, pct: pct(healthy, xs.length) }; });
  const fieldsBySegment = FIELDS.map((f) => ({ field: f.field, bySegment: Object.fromEntries(SEGMENTS.map((s) => { const xs = rows.filter((r) => r.customer.segment === s && f.applies(r)); return [s, xs.length ? pct(xs.filter(f.ok).length, xs.length) : null]; })) as Record<Segment, number | null> }));
  const month0 = asOf.slice(0, 7);
  const months = Array.from({ length: 6 }, (_, i) => { const d = new Date(`${month0}-01T00:00:00Z`); d.setUTCMonth(d.getUTCMonth() + i); return d.toISOString().slice(0, 7); });
  const expiriesByMonth = months.map((m) => ({ month: m, qid: rows.filter((r) => r.customer.qidExpiry?.slice(0, 7) === m && r.customer.qidExpiry >= asOf).length, passport: rows.filter((r) => !r.customer.isQatari && r.customer.passportExpiry?.slice(0, 7) === m && r.customer.passportExpiry >= asOf).length }));
  const within = (d: string | null, days: number) => !!d && d >= asOf && d <= addDays(asOf, days);
  const expiriesAhead = { qid30: rows.filter((r) => within(r.customer.qidExpiry, 30)).length, qid90: rows.filter((r) => within(r.customer.qidExpiry, 90)).length, passport30: rows.filter((r) => !r.customer.isQatari && within(r.customer.passportExpiry, 30)).length, passport90: rows.filter((r) => !r.customer.isQatari && within(r.customer.passportExpiry, 90)).length };
  const contactability = { marketingConsent: rows.filter((r) => r.marketingConsent).length, appRegistered: rows.filter((r) => r.appRegistered).length, dnc: rows.filter((r) => r.dnc).length, contactable: rows.filter((r) => !r.dnc && ['NORMAL', 'DORMANT', 'BLOCKED_KYC', 'BLOCKED_SALARY'].includes(r.customer.status)).length };
  const curable = { classA: fall.filter((r) => r.cls === 'A').length, classB: fall.filter((r) => r.cls === 'B').length, amountA: 0 };
  const empMap = new Map<string, number>();
  for (const r of fall) if (r.reasons.includes('R02') && r.customer.employerId) empMap.set(r.customer.employerId, (empMap.get(r.customer.employerId) ?? 0) + 1);
  const employers = [...empMap.entries()].map(([id, customers]) => ({ id, customers, status: employerStatus[id] ?? 'UNKNOWN' })).sort((a, b) => b.customers - a.customers).slice(0, 12);
  return { asOf, customers: n, eligible, eligibleRate: n ? Math.round((1000 * eligible) / n) / 10 : 0, fallouts: fall.length, bySegment, byClass, byReason, multiReason, fields, fieldsBySegment, expiriesByMonth, expiriesAhead, contactability, curable, employers };
}
