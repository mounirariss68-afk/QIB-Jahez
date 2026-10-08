/**
 * The eligibility check (DESIGN §10, "Eligibility arithmetic"). Deterministic,
 * reads every constant from the Policy, returns the reasons in QIB rank order
 * and the inputs it used so a screen or Dalil can show the arithmetic.
 *
 *   dbrBase          = basic + socialAllowance (Qatari) | salaryTotal (resident)
 *   obligations      = Σ instalments + cardMinPaymentPct × card outstanding + Σ counted standing orders
 *   capacity         = dbrBase × dbrPct − obligations          → ≤ 0: R04 if removing counted SOs restores it, else R03
 *   tenor            = min(maxTenor, monthsToAgeLimit)          → < minTenorMonths: R10
 *   annuityFactor    = (1 − (1 + r)^−tenor) / r                 r = indicativeRate / 12
 *   amountByCapacity = capacity × annuityFactor
 *   headroom         = cap − existing repayable exposure        → ≤ 0: R03
 *   amountByCap      = headroom × annuityFactor / tenor
 *   amount           = min(amountByCapacity, amountByCap) rounded down to 500   → < minEligible: R12
 */
import type { Policy } from './policy.js';
import { REASON, classOf } from './reasons.js';
import type { CustomerFacts, Eligibility, ReasonCode } from './types.js';

export type RuleCheck = { code: ReasonCode; pass: boolean; detail: string };
export type Qualification = Eligibility & { checks: RuleCheck[] };

export const RATING_ORDER = ['AAA', 'AA', 'A', 'BBB', 'BB', 'B', 'CCC', 'CC', 'C', 'D'];
export const ratingMeets = (rating: string, threshold: string) => RATING_ORDER.indexOf(rating) >= 0 && RATING_ORDER.indexOf(rating) <= RATING_ORDER.indexOf(threshold);

export const roundTo = (n: number, step: number) => Math.floor(n / step) * step;
export const annuityFactor = (ratePctPa: number, tenor: number) => { const r = ratePctPa / 100 / 12; return r === 0 ? tenor : (1 - Math.pow(1 + r, -tenor)) / r; };

/** Whole months between two ISO dates (b − a), floored. */
export function monthsBetween(a: string, b: string): number {
  const [ay, am, ad] = a.split('-').map(Number); const [by, bm, bd] = b.split('-').map(Number);
  let m = (by - ay) * 12 + (bm - am); if (bd < ad) m -= 1; return m;
}
export function ageAt(dob: string, on: string): number { return Math.floor(monthsBetween(dob, on) / 12); }
export function addMonths(iso: string, n: number): string { const d = new Date(iso + 'T00:00:00Z'); d.setUTCMonth(d.getUTCMonth() + n); return d.toISOString().slice(0, 10); }
export function addDays(iso: string, n: number): string { const d = new Date(iso + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
export function daysBetween(a: string, b: string): number { return Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 86_400_000); }
/** The last N complete calendar months before `today` (YYYY-MM), oldest first. */
export function windowMonths(today: string, n: number): string[] {
  const out: string[] = []; const d = new Date(today.slice(0, 7) + '-01T00:00:00Z');
  for (let i = n; i >= 1; i--) { const x = new Date(d); x.setUTCMonth(x.getUTCMonth() - i); out.push(x.toISOString().slice(0, 7)); }
  return out;
}
const median = (xs: number[]) => { if (!xs.length) return 0; const s = [...xs].sort((a, b) => a - b); const m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

/** Standing orders counted as obligations under the counting rule: the customer's classification overrides the bank's beneficiary type. */
export function countedStandingOrders(f: CustomerFacts, policy: Policy) {
  const rule = policy.str('standingOrderCounting');
  return f.standingOrders.filter((s) => { const t = (s.classified ?? s.type).toUpperCase(); return rule === 'ALL' ? true : t === 'FI'; });
}

export function qualify(f: CustomerFacts, policy: Policy, today: string): Qualification {
  const checks: RuleCheck[] = [];
  const fail = (code: ReasonCode, detail: string) => checks.push({ code, pass: false, detail });
  const pass = (code: ReasonCode, detail: string) => checks.push({ code, pass: true, detail });

  // ---- status, notes, segment, nationality (C/B/A by class table)
  if (f.status !== 'NORMAL') fail('R13', `Status ${f.status}`); else pass('R13', 'Status Normal');
  const activeNotes = f.notes.filter((n) => !n.lifted);
  if (activeNotes.length) fail('R05', `Active note: ${activeNotes.map((n) => n.type).join(', ')}`); else pass('R05', 'No cautionary note');
  if (f.segmentTag && policy.list('ineligibleSegmentTags').includes(f.segmentTag)) fail('R18', `Segment tag ${f.segmentTag}`); else pass('R18', 'Eligible segment');
  if (policy.list('restrictedNationalities').includes(f.nationality)) fail('R11', `Nationality ${f.nationality} is on the restricted list`); else pass('R11', 'Nationality not restricted');

  // ---- age and tenor
  const ageMin = policy.num(f.isQatari ? 'ageMinQatari' : 'ageMinResident');
  const ageMax = policy.num(f.isQatari ? 'ageMaxQatari' : 'ageMaxResident');
  const age = ageAt(f.dob, today);
  const monthsToAgeLimit = Math.max(0, monthsBetween(today, addMonths(f.dob, ageMax * 12)));
  const maxTenor = policy.num(f.isQatari ? 'tenorQatari' : 'tenorResident');
  const tenor = Math.min(maxTenor, monthsToAgeLimit);
  const minTenor = policy.num('minTenorMonths');
  if (age < ageMin) fail('R10', `Age ${age} is below the minimum ${ageMin}`);
  else if (tenor < minTenor) fail('R10', `${monthsToAgeLimit} months to the age limit of ${ageMax}; minimum tenor is ${minTenor}`);
  else pass('R10', `Age ${age}; ${monthsToAgeLimit} months to the age limit; tenor ${tenor}`);

  // ---- documents
  if (!f.qidExpiry || f.qidExpiry < today) fail('R07', f.qidExpiry ? `QID expired ${f.qidExpiry}` : 'No QID on record'); else pass('R07', `QID valid to ${f.qidExpiry}`);
  if (!f.isQatari && policy.bool('requirePassportResidents')) {
    if (!f.passportExpiry || f.passportExpiry < today) fail('R06', f.passportExpiry ? `Passport expired ${f.passportExpiry}` : 'No passport on record'); else pass('R06', `Passport valid to ${f.passportExpiry}`);
  } else pass('R06', 'Passport not required');

  // ---- employer
  if (policy.bool('requireApprovedEmployer')) {
    if (!f.employerId) fail('R02', 'No employer on the record');
    else if (f.employerStatus !== 'APPROVED') fail('R02', `Employer ${f.employerId} is ${f.employerStatus}`);
    else pass('R02', `Employer ${f.employerId} approved`);
  } else pass('R02', 'Employer approval not required');

  // ---- salary history
  const months = windowMonths(today, policy.num('salaryWindowMonths'));
  const credits = new Map(f.salaryCredits.map((c) => [c.month, c.amount]));
  const paid = months.map((m) => credits.get(m) ?? 0).filter((a) => a > 0);
  const med = median(paid);
  const lowPct = policy.num('lowSalaryPct');
  const salaryMissing = months.filter((m) => !(credits.get(m) ?? 0) && !f.explainedGaps.includes(m));
  const salaryLow = months.filter((m) => (credits.get(m) ?? 0) > 0 && (credits.get(m) ?? 0) < (med * lowPct) / 100 && !f.explainedGaps.includes(m));
  if (salaryMissing.length || salaryLow.length) fail('R01', [salaryMissing.length ? `missing ${salaryMissing.join(', ')}` : '', salaryLow.length ? `low ${salaryLow.join(', ')} (below ${lowPct}% of the median QAR ${Math.round(med).toLocaleString('en-US')})` : ''].filter(Boolean).join('; '));
  else pass('R01', `${months.length} months credited, median QAR ${Math.round(med).toLocaleString('en-US')}`);

  // ---- current account
  if (policy.bool('requireCurrentAccount') && !f.hasCurrentAccount) fail('R08', 'No current account'); else pass('R08', 'Current account held');

  // ---- obligations, capacity, cap
  const dbrBase = f.isQatari ? f.basic + f.socialAllowance : f.salaryTotal;
  const dbrPct = policy.num(f.isQatari ? 'dbrQatari' : 'dbrResident');
  const counted = countedStandingOrders(f, policy);
  const soCounted = counted.reduce((s, x) => s + x.amount, 0);
  const instalments = f.facilities.reduce((s, x) => s + x.instalment, 0);
  const cardMin = f.cards.reduce((s, x) => s + (x.outstanding * policy.num('cardMinPaymentPct')) / 100, 0);
  const obligations = instalments + cardMin + soCounted;
  const capacity = (dbrBase * dbrPct) / 100 - obligations;
  const soLimit = (f.salaryTotal * policy.num('standingOrderLimitPct')) / 100;
  const soBreach = soCounted > soLimit || (capacity <= 0 && capacity + soCounted > 0);
  if (soBreach) fail('R04', `Counted standing orders QAR ${Math.round(soCounted).toLocaleString('en-US')} against a limit of QAR ${Math.round(soLimit).toLocaleString('en-US')} (${policy.num('standingOrderLimitPct')}% of salary)`);
  else pass('R04', counted.length ? `Counted standing orders QAR ${Math.round(soCounted).toLocaleString('en-US')} within the limit` : 'No counted standing orders');
  const cap = policy.num(f.isQatari ? 'capQatari' : 'capResident');
  const exposure = f.facilities.reduce((s, x) => s + x.repayable, 0);
  const headroom = cap - exposure;
  const af = annuityFactor(policy.num('indicativeRatePct'), Math.max(tenor, 1));
  const amountByCapacity = Math.max(0, capacity) * af;
  const amountByCap = (Math.max(0, headroom) * af) / Math.max(tenor, 1);
  let amount = roundTo(Math.max(0, Math.min(amountByCapacity, amountByCap)), 500);
  if (headroom <= 0) fail('R03', `Existing repayable exposure QAR ${Math.round(exposure).toLocaleString('en-US')} is at the cap of QAR ${cap.toLocaleString('en-US')}`);
  else if (capacity <= 0 && !soBreach) fail('R03', `Obligations QAR ${Math.round(obligations).toLocaleString('en-US')} exceed ${dbrPct}% of the DBR base QAR ${Math.round(dbrBase).toLocaleString('en-US')}`);
  else pass('R03', `Headroom QAR ${Math.round(headroom).toLocaleString('en-US')}; capacity QAR ${Math.round(capacity).toLocaleString('en-US')} a month`);

  // ---- conduct (class D)
  const finDpd = f.facilities.filter((x) => x.dpd > 0);
  if (finDpd.length) fail('R15', `Finance ${Math.max(...finDpd.map((x) => x.dpd))} days past due`); else pass('R15', 'No finance past due');
  const cardDpd = f.cards.filter((x) => x.dpd > 0);
  if (cardDpd.length) fail('R16', `Card ${Math.max(...cardDpd.map((x) => x.dpd))} days past due`); else pass('R16', 'No card past due');
  const irregular = f.facilities.filter((x) => x.irregular || x.late6m >= policy.num('irregularLatePayments6m'));
  if (irregular.length) fail('R14', irregular[0].irregular ? 'Restructured or deferred schedule' : `${Math.max(...irregular.map((x) => x.late6m))} late instalments in six months`); else pass('R14', 'Payments regular');
  const lookback = policy.num('returnedChequeLookbackMonths');
  const listed = f.returnedCheques.filter((ch) => !ch.settledOn || addMonths(ch.settledOn, lookback) > today);
  if (listed.length) fail('R17', listed[0].settledOn ? `Returned cheque settled ${listed[0].settledOn}; listed until ${addMonths(listed[0].settledOn, lookback)}` : `Returned cheque of ${listed[0].returnedOn} not settled`); else pass('R17', 'No returned cheques in the lookback');

  // ---- model, rating, products
  if (f.modelScore < policy.num('modelCutOff')) fail('R09', `Model score ${f.modelScore.toFixed(2)} below the cut-off ${policy.num('modelCutOff')}`); else pass('R09', `Model score ${f.modelScore.toFixed(2)}`);
  if (!ratingMeets(f.rating, policy.str('ratingThreshold'))) fail('R19', `Rating ${f.rating} below ${policy.str('ratingThreshold')}`); else pass('R19', `Rating ${f.rating}`);
  const vehicleOk = f.autoIjaraScore >= policy.num('autoIjaraCutOff');
  if (!vehicleOk) fail('R20', `Auto Ijara score ${f.autoIjaraScore.toFixed(2)} below ${policy.num('autoIjaraCutOff')} (vehicle finance only)`); else pass('R20', `Auto Ijara score ${f.autoIjaraScore.toFixed(2)}`);

  // ---- minimum amount, computed only when the arithmetic itself is sound
  const arithmeticFails = checks.some((c) => !c.pass && (c.code === 'R03' || c.code === 'R04' || c.code === 'R10'));
  if (!arithmeticFails && amount < policy.num('minEligible')) fail('R12', `Eligible amount QAR ${amount.toLocaleString('en-US')} below the minimum QAR ${policy.num('minEligible').toLocaleString('en-US')}`);
  else pass('R12', `Eligible amount QAR ${amount.toLocaleString('en-US')}`);

  const reasons = checks.filter((c) => !c.pass).map((c) => c.code).sort((a, b) => REASON[a].rank - REASON[b].rank);
  const blocking = reasons.filter((r) => r !== 'R20');
  const eligible = blocking.length === 0;
  if (!eligible) amount = 0;
  return {
    eligible, eligibleVehicle: eligible && vehicleOk, amount, reasons, cls: eligible ? null : classOf(blocking), checks,
    inputs: { dbrBase, dbrPct, obligations: Math.round(obligations), capacity: Math.round(capacity), monthsToAgeLimit, tenor, cap, exposure: Math.round(exposure), headroom: Math.round(headroom), amountByCapacity: Math.round(amountByCapacity), amountByCap: Math.round(amountByCap), salaryMissing, salaryLow, standingOrdersCounted: Math.round(soCounted) },
  };
}

/** What-if: re-run with overrides (salary, obligations removed, tenor) for Dalil's explain_eligibility. */
export function whatIf(f: CustomerFacts, policy: Policy, today: string, w: { salaryTotal?: number; dropStandingOrders?: boolean; clearDpd?: boolean; employerApproved?: boolean; qidRenewed?: boolean }): Qualification {
  const g: CustomerFacts = { ...f, facilities: f.facilities.map((x) => ({ ...x })), cards: f.cards.map((x) => ({ ...x })), standingOrders: [...f.standingOrders], salaryCredits: [...f.salaryCredits] };
  if (w.salaryTotal !== undefined) { g.salaryTotal = w.salaryTotal; g.basic = Math.round(w.salaryTotal * 0.6); const months = windowMonths(today, policy.num('salaryWindowMonths')); g.salaryCredits = months.map((m) => ({ month: m, amount: w.salaryTotal! })); }
  if (w.dropStandingOrders) g.standingOrders = [];
  if (w.clearDpd) { g.facilities.forEach((x) => { x.dpd = 0; }); g.cards.forEach((x) => { x.dpd = 0; }); }
  if (w.employerApproved) { g.employerId = g.employerId ?? 'DEMO-E-000'; g.employerStatus = 'APPROVED'; }
  if (w.qidRenewed) { g.qidExpiry = addMonths(today, 36); g.passportExpiry = g.passportExpiry && g.passportExpiry < today ? addMonths(today, 60) : g.passportExpiry; }
  return qualify(g, policy, today);
}
