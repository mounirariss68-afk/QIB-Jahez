/**
 * The synthetic base (DESIGN §11): 2,400 customers by default, Qatari 30% /
 * residents 70%, segment mix from the DATA parameters, 35% eligible, with
 * fall-out reasons injected in QIB's rank order with decaying weights. Every
 * identifier is DEMO-. The generator reads the policy so the base matches the
 * eligibility rules it will be checked against.
 */
import { addDays, addMonths, windowMonths, type Policy, type Segment, type ReasonCode } from '@jahiz/domain';
import { Rng } from './rng.js';
import * as N from './names.js';

export type Gen = {
  employers: any[]; rms: any[]; customers: any[]; documents: any[]; contacts: any[]; consents: any[]; employment: any[]; credits: any[]; accounts: any[]; facilities: any[]; cards: any[]; sos: any[]; cheques: any[]; notes: any[];
  injected: Map<string, ReasonCode[]>;
};
export type Draft = {
  id: string; isQatari: boolean; gender: 'M' | 'F'; nameEn: string; nameAr: string; dob: string; nationality: string; segment: Segment; privateBanking: boolean; rmId: string | null; status: string; segmentTag: string | null;
  lang: 'en' | 'ar'; joined: string; basic: number; allowances: number; social: number; total: number; employerId: string | null; employerRaw: string | null; salaryBank: string;
  qid: { number: string; issued: string; expires: string }; passport: { number: string; issued: string; expires: string } | null;
  mobile: string; email: string; app: boolean; push: boolean; marketing: boolean; optouts: string[]; dnc: boolean;
  credits: { month: string; amount: number; reason?: string }[]; current: boolean; savings: number; deposits: number;
  facilities: { product: string; principal: number; outstanding: number; repayable: number; instalment: number; start: string; maturity: string; dpd: number; dpdSince: string | null; late6m: number; irregular: boolean }[];
  cards: { limit: number; outstanding: number; dpd: number; dpdSince: string | null }[];
  sos: { type: string; name: string; amount: number }[]; cheques: { on: string; amount: number; settled: string | null }[]; notes: { type: string; on: string; by: string; cond: string }[];
  modelScore: number; rating: string; autoIjara: number; riskRating: string; injected: ReasonCode[];
};

const pad = (n: number, w: number) => String(n).padStart(w, '0');
const sectorNames = ['Trading', 'Contracting', 'Services', 'Holdings', 'Technologies', 'Logistics', 'Foods', 'Medical', 'Engineering', 'Properties'];

export function generateDrafts(policy: Policy, today: string, seed = policy.num('dataSeed')): { drafts: Draft[]; employers: any[]; rms: any[] } {
  const rng = new Rng(seed);
  const N_CUST = policy.num('dataCustomers');
  const qatariPct = policy.num('dataQatariPct') / 100;
  const mix = policy.nums('dataSegmentMix'); // VVIP HNWI HV MASS
  const eligibleRate = policy.num('dataEligibleRate') / 100;
  const weights = policy.nums('dataReasonWeights');
  const consentPct = policy.num('dataMarketingConsentPct') / 100;
  const months12 = windowMonths(today, 12);

  // ---- employers: the named ones plus generated ones to ~120 (70% approved, 30% not)
  const employers: any[] = N.EMPLOYERS.map((e, i) => ({ id: `DEMO-E-${pad(i + 1, 3)}`, name_en: e.en, name_ar: e.ar, sector: e.sector, cr_number: `CR-${pad(10000 + i * 37, 6)}`, cr_valid_to: addMonths(today, rng.int(3, 30)), wps_active: true, headcount_band: e.band, headcount: e.headcount, months_operating: e.months, approval_status: e.status, approved_on: e.status === 'APPROVED' ? addMonths(today, -rng.int(12, 120)) : null, finance_history: e.status === 'APPROVED' ? 'No defaults on record' : null }));
  for (let i = employers.length; i < 120; i++) {
    const approved = rng.chance(0.68);
    const sector = rng.pick(['CONSTRUCTION', 'RETAIL', 'HOSPITALITY', 'IT', 'LOGISTICS', 'HEALTHCARE', 'EDUCATION', 'FACILITIES', 'PROFESSIONAL', 'MANUFACTURING']);
    const nm = `${rng.pick(['Al Sadd', 'Al Gharrafa', 'Dafna', 'Mesaieed', 'Umm Salal', 'Al Shamal', 'Doha', 'Al Wajba', 'Al Hilal', 'Madinat Khalifa', 'Bin Mahmoud', 'Al Duhail'])} ${rng.pick(sectorNames)} ${rng.pick(['W.L.L.', 'Co.', 'Group', 'LLC'])}`;
    const headcount = approved ? rng.int(25, 3000) : rng.int(3, 60);
    employers.push({ id: `DEMO-E-${pad(i + 1, 3)}`, name_en: nm, name_ar: `شركة ${nm.split(' ')[0]} ${nm.split(' ')[1]}`, sector, cr_number: approved || rng.chance(0.7) ? `CR-${pad(20000 + i * 53, 6)}` : null, cr_valid_to: addMonths(today, rng.int(-2, 30)), wps_active: approved || rng.chance(0.6), headcount_band: headcount >= 1000 ? '1000-4999' : headcount >= 100 ? '100-999' : headcount >= 20 ? '20-99' : '1-19', headcount, months_operating: approved ? rng.int(24, 300) : rng.int(3, 40), approval_status: approved ? 'APPROVED' : 'UNAPPROVED', approved_on: approved ? addMonths(today, -rng.int(6, 100)) : null, finance_history: approved ? 'No defaults on record' : null });
  }
  // DEMO-E-047 is the leverage case: unapproved but meets every criterion.
  const e47 = employers[46]; Object.assign(e47, { name_en: 'Rayyan Digital Solutions W.L.L.', name_ar: 'الريان للحلول الرقمية', sector: 'IT', cr_number: 'CR-047112', cr_valid_to: addMonths(today, 18), wps_active: true, headcount_band: '20-99', headcount: 85, months_operating: 30, approval_status: 'UNAPPROVED', approved_on: null, finance_history: null });
  employers[20].name_en = 'Rayyan Digital Services (branch)'; employers[20].name_ar = 'الريان للخدمات الرقمية (فرع)';
  const approvedEmployers = employers.filter((e) => e.approval_status === 'APPROVED');
  const unapprovedEmployers = employers.filter((e) => e.approval_status === 'UNAPPROVED' && e.id !== 'DEMO-E-047');
  const rms = [1, 2, 3, 4, 5, 6].map((i) => ({ id: `DEMO-RM-${pad(i, 2)}`, name_en: ['Abdulla Al-Emadi', 'Hessa Al-Khater', 'Omar Haddad', 'Noora Al-Jaber', 'Rashid Al-Naimi', 'Dina Mansour'][i - 1], name_ar: ['عبدالله العمادي', 'حصة الخاطر', 'عمر حداد', 'نورة الجابر', 'راشد النعيمي', 'دينا منصور'][i - 1], tier: i <= 2 ? 'PRIVATE' : 'TAMAYUZ', persona_key: i === 1 ? 'rm' : null }));

  const pools = { QATARI: [N.QATARI_MALE, N.QATARI_FEMALE, N.QATARI_FAMILY], ARAB: [N.ARAB_MALE, N.ARAB_FEMALE, N.ARAB_FAMILY], SOUTH_ASIAN: [N.SOUTH_ASIAN_MALE, N.SOUTH_ASIAN_FEMALE, N.SOUTH_ASIAN_FAMILY], FILIPINO: [N.FILIPINO_MALE, N.FILIPINO_FEMALE, N.FILIPINO_FAMILY], WESTERN: [N.WESTERN_MALE, N.WESTERN_FEMALE, N.WESTERN_FAMILY] } as const;
  const usedEmails = new Set<string>();

  const drafts: Draft[] = [];
  for (let i = 1; i <= N_CUST; i++) {
    const id = `DEMO-C-${pad(i, 5)}`;
    const isQatari = rng.chance(qatariPct);
    const nat = isQatari ? { code: 'QAT', pool: 'QATARI' as const } : rng.weighted(N.NATIONALITIES.map((n) => ({ v: n, w: n.w })));
    const gender: 'M' | 'F' = rng.chance(isQatari ? 0.55 : 0.72) ? 'M' : 'F';
    const [males, females, families] = pools[nat.pool as keyof typeof pools];
    const given = rng.pick(gender === 'M' ? males : females); const mid = isQatari || nat.pool === 'ARAB' ? rng.pick(males) : null; const fam = rng.pick(families);
    const nameEn = mid ? `${given.en} ${mid.en} ${fam.en}` : `${given.en} ${fam.en}`;
    const nameAr = mid ? `${given.ar} ${mid.ar} ${fam.ar}` : `${given.ar} ${fam.ar}`;
    const age = rng.int(23, 56);
    const dob = addDays(addMonths(today, -age * 12 - rng.int(0, 11)), -rng.int(0, 27));
    const segment = rng.weighted<Segment>([{ v: 'VVIP', w: mix[0] }, { v: 'HNWI', w: mix[1] }, { v: 'HIGH_VALUE', w: mix[2] }, { v: 'MASS', w: mix[3] }]);
    const total = segment === 'VVIP' ? rng.round(rng.int(60000, 150000), 500) : segment === 'HNWI' ? rng.round(rng.int(50000, 95000), 500) : segment === 'HIGH_VALUE' ? rng.round(rng.int(20000, 48000), 500) : rng.round(rng.int(isQatari ? 8000 : 4000, 19500), 250);
    const deposits = segment === 'VVIP' ? rng.int(1_000_000, 5_000_000) : segment === 'HNWI' ? rng.int(120_000, 1_200_000) : segment === 'HIGH_VALUE' ? rng.int(10_000, 180_000) : rng.int(500, 60_000);
    const social = isQatari ? rng.round(Math.min(total * 0.25, rng.int(2000, 6000)), 100) : 0;
    const basic = rng.round((total - social) * (isQatari ? 0.62 : 0.58), 50);
    const allowances = total - social - basic;
    const employer = rng.weighted(approvedEmployers.map((e) => ({ v: e, w: Math.sqrt(e.headcount) })));
    const yy = String(new Date(today).getUTCFullYear()).slice(2);
    const qidNumber = `2${String(Number(dob.slice(0, 4))).slice(1, 3)}${pad(rng.int(0, 999), 3)}${pad(i, 5)}`;
    const qidExp = addMonths(today, rng.int(4, 36));
    const d: Draft = {
      id, isQatari, gender, nameEn, nameAr, dob, nationality: nat.code, segment, privateBanking: segment === 'VVIP', rmId: segment === 'VVIP' ? rng.pick(['DEMO-RM-01', 'DEMO-RM-02']) : segment === 'HNWI' ? rng.pick(['DEMO-RM-01', 'DEMO-RM-03', 'DEMO-RM-04', 'DEMO-RM-05', 'DEMO-RM-06']) : null,
      status: 'NORMAL', segmentTag: null, lang: isQatari ? 'ar' : nat.pool === 'ARAB' ? (rng.chance(0.7) ? 'ar' : 'en') : 'en', joined: addMonths(today, -rng.int(8, 180)),
      basic, allowances, social, total, employerId: employer.id, employerRaw: null, salaryBank: 'QIB',
      qid: { number: qidNumber, issued: addMonths(qidExp, -36), expires: qidExp }, passport: isQatari ? null : { number: `${nat.code[0]}${pad(rng.int(1000000, 9999999), 7)}`, issued: addMonths(today, -rng.int(12, 60)), expires: addMonths(today, rng.int(6, 96)) },
      mobile: `+974 ${rng.pick([3, 5, 6, 7])}${pad(rng.int(0, 999), 3)} ${pad(rng.int(0, 9999), 4)}`, email: '', app: rng.chance(0.83), push: true, marketing: rng.chance(consentPct), optouts: rng.chance(0.04) ? [rng.pick(['SMS', 'EMAIL', 'PUSH'])] : [], dnc: rng.chance(0.005),
      credits: months12.map((m) => ({ month: m, amount: rng.round(total * (1 + (rng.next() - 0.5) * 0.02), 1) })), current: true, savings: rng.int(500, 40000), deposits,
      facilities: [], cards: [], sos: [], cheques: [], notes: [], modelScore: Math.round((0.45 + rng.next() * 0.5) * 1000) / 1000, rating: rng.pick(['AAA', 'AA', 'A', 'A', 'BBB', 'BBB']), autoIjara: Math.round((0.5 + rng.next() * 0.45) * 1000) / 1000, riskRating: rng.pick(['LOW', 'LOW', 'MEDIUM']), injected: [],
    };
    d.push = d.app && rng.chance(0.9);
    let email = `${given.en.toLowerCase()}.${fam.en.toLowerCase().replace(/[^a-z]/g, '')}@demo-mail.example`; let k = 1; while (usedEmails.has(email)) email = `${given.en.toLowerCase()}.${fam.en.toLowerCase().replace(/[^a-z]/g, '')}${++k}@demo-mail.example`; usedEmails.add(email); d.email = email;
    // Clean obligations: one facility for 45%, a card for 60%, non-FI standing orders for 30%. Kept under the DBR.
    const dbrBase = isQatari ? basic + social : total;
    const dbrCap = (dbrBase * policy.num(isQatari ? 'dbrQatari' : 'dbrResident')) / 100;
    if (rng.chance(0.45)) {
      const product = rng.weighted([{ v: 'PERSONAL', w: 6 }, { v: 'AUTO_IJARA', w: 3 }, { v: 'HOME', w: segment === 'MASS' ? 0.3 : 2 }]);
      const remaining = rng.int(6, product === 'HOME' ? 180 : 54);
      const instalment = rng.round(Math.min(dbrCap * 0.35, total * (product === 'HOME' ? 0.3 : 0.18)) * (0.5 + rng.next() * 0.5), 50);
      const repayable = instalment * remaining; const outstanding = Math.round(repayable / 1.08);
      d.facilities.push({ product, principal: Math.round(outstanding * (1 + rng.next())), outstanding, repayable, instalment, start: addMonths(today, -rng.int(3, 36)), maturity: addMonths(today, remaining), dpd: 0, dpdSince: null, late6m: 0, irregular: false });
    }
    if (rng.chance(0.6)) { const limit = rng.round(total * rng.int(2, 6), 1000); d.cards.push({ limit, outstanding: rng.round(limit * rng.next() * 0.4, 100), dpd: 0, dpdSince: null }); }
    if (rng.chance(0.3)) for (let s = 0; s < rng.int(1, 2); s++) { const type = rng.pick(['SCHOOL', 'FAMILY', 'RENT']); d.sos.push({ type, name: type === 'SCHOOL' ? 'Doha International School' : type === 'FAMILY' ? 'Family transfer' : 'Landlord', amount: rng.round(total * (type === 'RENT' ? 0.2 : 0.08) * (0.6 + rng.next() * 0.8), 50) }); }
    drafts.push(d);
  }

  // ---- inject fall-out reasons into 1 − eligibleRate of the base, in rank order with decaying weights
  const reasonCodes = Array.from({ length: 20 }, (_, i) => `R${pad(i + 1, 2)}` as ReasonCode);
  const pool = reasonCodes.map((code, i) => ({ v: code, w: weights[i] ?? 0.5 }));
  const nFall = Math.round(N_CUST * (1 - eligibleRate));
  const order = rng.shuffle(drafts.map((_, i) => i)).slice(0, nFall);
  const months6 = windowMonths(today, 6);
  const inject = (d: Draft, code: ReasonCode): boolean => {
    switch (code) {
      case 'R01': {
        // A single gap sits early in the window (the payroll run never revisits a past month); a stopped salary runs from a month to the end, so the next payroll finds no prior credit and stays silent; a low month keeps a small credit.
        const kind = rng.weighted([{ v: 'GAP', w: 5 }, { v: 'STOPPED', w: 3 }, { v: 'LOW', w: 2 }]);
        if (kind === 'GAP') { const m = rng.pick(months6.slice(0, 3)); d.credits.find((c) => c.month === m)!.amount = 0; }
        else if (kind === 'STOPPED') { const from = rng.int(1, 4); for (const m of months6.slice(from)) d.credits.find((c) => c.month === m)!.amount = 0; }
        else { const m = rng.pick(months6.slice(0, 5)); d.credits.find((c) => c.month === m)!.amount = rng.round(d.total * (0.3 + rng.next() * 0.35), 50); }
        return true;
      }
      // DEMO-E-047's staff are the fourteen named edge-case customers only (EC05 + E047_EXTRA_IDS), so the leverage scenario counts exactly fourteen.
      case 'R02': { if (rng.chance(0.33)) { d.employerId = null; d.employerRaw = rng.chance(0.5) ? null : rng.pick(employers).name_en; } else { const e = rng.pick(unapprovedEmployers); d.employerId = e.id; } return true; }
      case 'R03': { const cap = policy.num(d.isQatari ? 'capQatari' : 'capResident'); const remaining = rng.int(24, 60); const repayable = Math.round(cap * (1 + rng.next() * 0.1)); d.facilities = [{ product: d.isQatari ? 'HOME' : 'PERSONAL', principal: Math.round(repayable * 0.9), outstanding: Math.round(repayable / 1.06), repayable, instalment: Math.min(Math.round(repayable / remaining), Math.round(((d.isQatari ? d.basic + d.social : d.total) * policy.num(d.isQatari ? 'dbrQatari' : 'dbrResident')) / 100) - 200), start: addMonths(today, -12), maturity: addMonths(today, remaining), dpd: 0, dpdSince: null, late6m: 0, irregular: false }]; return true; }
      case 'R04': { const lim = (d.total * policy.num('standingOrderLimitPct')) / 100; d.sos.push({ type: 'FI', name: rng.pick(['Doha Bank', 'Commercial Bank', 'Dukhan Bank', 'Masraf Al Rayan', 'QNB']), amount: rng.round(lim * (1.1 + rng.next() * 0.6), 50) }); return true; }
      case 'R05': { const t = rng.weighted([{ v: 'KYC_EXPIRED', w: 3 }, { v: 'SALARY_STOPPED', w: 2 }, { v: 'COURT_ATTACHMENT', w: 1 }, { v: 'SANCTIONS', w: 0.3 }, { v: 'FRAUD_AML', w: 0.4 }, { v: 'LEGAL_HOLD', w: 0.5 }]); d.notes.push({ type: t, on: addDays(today, -rng.int(10, 400)), by: t === 'KYC_EXPIRED' ? 'KYC Unit' : t === 'SALARY_STOPPED' ? 'Retail Credit' : 'Compliance', cond: t === 'KYC_EXPIRED' ? 'Valid identity document on file' : t === 'SALARY_STOPPED' ? 'Salary credit resumes for 3 months' : t === 'COURT_ATTACHMENT' ? 'Discharge certificate from the court' : t === 'SANCTIONS' ? 'Delisting' : 'Compliance clearance' }); if (t === 'KYC_EXPIRED') d.qid.expires = addDays(today, -rng.int(30, 300)); return true; }
      case 'R06': { if (!d.passport) return false; d.passport.expires = addDays(today, -rng.int(1, 400)); return true; }
      case 'R07': { d.qid.expires = addDays(today, -rng.int(1, 300)); d.qid.issued = addMonths(d.qid.expires, -36); return true; }
      case 'R08': { d.current = false; return true; }
      case 'R09': { d.modelScore = Math.round((0.15 + rng.next() * 0.26) * 1000) / 1000; return true; }
      case 'R10': { const max = policy.num(d.isQatari ? 'ageMaxQatari' : 'ageMaxResident'); d.dob = addMonths(today, -(max * 12 - rng.int(2, 11))); return true; }
      case 'R11': { d.nationality = rng.pick(policy.list('restrictedNationalities')); d.isQatari = false; if (!d.passport) d.passport = { number: `X${pad(rng.int(1000000, 9999999), 7)}`, issued: addMonths(today, -24), expires: addMonths(today, 48) }; return true; }
      case 'R12': { d.total = 6000; d.basic = 3600; d.allowances = 2400; d.social = 0; d.credits.forEach((c) => { if (c.amount > 0) c.amount = 6000; }); d.facilities = [{ product: 'PERSONAL', principal: 60000, outstanding: 42000, repayable: 46000, instalment: 2850, start: addMonths(today, -8), maturity: addMonths(today, 16), dpd: 0, dpdSince: null, late6m: 0, irregular: false }]; d.cards = []; d.sos = []; return true; }
      case 'R13': { d.status = rng.weighted([{ v: 'DORMANT', w: 5 }, { v: 'BLOCKED_KYC', w: 2 }, { v: 'BLOCKED_SALARY', w: 1.5 }, { v: 'BLOCKED_DELINQ', w: 1 }, { v: 'FROZEN_COURT', w: 0.4 }, { v: 'FROZEN_SANCTIONS', w: 0.2 }, { v: 'DECEASED', w: 0.2 }, { v: 'CLOSED', w: 0.3 }]); if (d.status === 'BLOCKED_KYC') d.qid.expires = addDays(today, -rng.int(100, 400)); return true; }
      case 'R14': { if (!d.facilities.length) { d.facilities.push({ product: 'PERSONAL', principal: 40000, outstanding: 25000, repayable: 27000, instalment: Math.min(1500, Math.round(d.total * 0.15)), start: addMonths(today, -12), maturity: addMonths(today, 18), dpd: 0, dpdSince: null, late6m: 0, irregular: false }); } const f = d.facilities[0]; if (rng.chance(0.7)) f.late6m = rng.int(2, 4); else f.irregular = true; return true; }
      case 'R15': { if (!d.facilities.length) d.facilities.push({ product: 'PERSONAL', principal: 40000, outstanding: 25000, repayable: 27000, instalment: Math.min(1500, Math.round(d.total * 0.15)), start: addMonths(today, -12), maturity: addMonths(today, 18), dpd: 0, dpdSince: null, late6m: 0, irregular: false }); const dpd = rng.int(1, 75); d.facilities[0].dpd = dpd; d.facilities[0].dpdSince = addDays(today, -dpd); return true; }
      case 'R16': { if (!d.cards.length) d.cards.push({ limit: 20000, outstanding: 9000, dpd: 0, dpdSince: null }); const dpd = rng.int(1, 75); d.cards[0].dpd = dpd; d.cards[0].dpdSince = addDays(today, -dpd); return true; }
      case 'R17': { const on = addDays(today, -rng.int(30, 900)); d.cheques.push({ on, amount: rng.round(rng.int(3000, 60000), 500), settled: rng.chance(0.7) ? addDays(on, rng.int(10, 120)) : null }); return true; }
      case 'R18': { d.segmentTag = rng.weighted([{ v: 'STAFF', w: 4 }, { v: 'NON_RESIDENT', w: 2 }, { v: 'CORPORATE_LINKED', w: 2 }, { v: 'MINOR', w: 0.3 }]); return true; }
      case 'R19': { d.rating = rng.pick(['BB', 'B', 'CCC']); return true; }
      case 'R20': { d.autoIjara = Math.round((0.2 + rng.next() * 0.29) * 1000) / 1000; return true; }
    }
  };
  for (const idx of order) {
    const d = drafts[idx];
    const k = rng.weighted([{ v: 1, w: 75 }, { v: 2, w: 17 }, { v: 3, w: 8 }]);
    const chosen = new Set<ReasonCode>();
    let guard = 0;
    while (chosen.size < k && guard++ < 30) {
      const code = rng.weighted(pool);
      if (chosen.has(code)) continue;
      if (code === 'R20' && chosen.size === 0 && k === 1) continue; // R20 alone does not block: keep it as a secondary
      if (inject(d, code)) chosen.add(code);
    }
    d.injected = [...chosen];
  }
  return { drafts, employers, rms };
}

export function materialise(drafts: Draft[], employers: any[], rms: any[], today: string): Gen {
  const g: Gen = { employers, rms, customers: [], documents: [], contacts: [], consents: [], employment: [], credits: [], accounts: [], facilities: [], cards: [], sos: [], cheques: [], notes: [], injected: new Map() };
  for (const d of drafts) {
    g.customers.push({ id: d.id, rim_no: `RIM${d.id.slice(-5)}`, name_en: d.nameEn, name_ar: d.nameAr, dob: d.dob, gender: d.gender, nationality: d.nationality, is_qatari: d.isQatari, segment: d.segment, segment_tag: d.segmentTag, private_banking: d.privateBanking, rm_id: d.rmId, status: d.status, status_since: d.status === 'NORMAL' ? null : addDays(today, -30), language_pref: d.lang, joined_on: d.joined, risk_rating: d.riskRating, internal_rating: d.rating, model_score: d.modelScore, auto_ijara_score: d.autoIjara, deposits: d.deposits, card_restricted: false });
    g.documents.push({ customer_id: d.id, type: 'QID', number: d.qid.number, issued_on: d.qid.issued, expires_on: d.qid.expires, verified_on: d.qid.issued, source: 'ONBOARDING', current: true, image_ref: null });
    if (d.passport) g.documents.push({ customer_id: d.id, type: 'PASSPORT', number: d.passport.number, issued_on: d.passport.issued, expires_on: d.passport.expires, verified_on: d.passport.issued, source: 'ONBOARDING', current: true, image_ref: null });
    g.contacts.push({ customer_id: d.id, mobile: d.mobile, email: d.email, address_en: 'Doha, Qatar (demo)', address_ar: 'الدوحة، قطر', app_registered: d.app, push_enabled: d.app && d.push, last_app_login: d.app ? addDays(today, -(Number(d.id.slice(-2)) % 9) - 1) : null });
    g.consents.push({ customer_id: d.id, marketing_consent: d.marketing, marketing_since: d.marketing ? addMonths(today, -14) : null, channel_optouts: d.optouts, dnc: d.dnc, dnc_since: d.dnc ? addMonths(today, -3) : null, dnc_reason: d.dnc ? 'Customer written request' : null, dnc_until: null, bureau_consent_on: addMonths(today, -14) });
    g.employment.push({ customer_id: d.id, employer_id: d.employerId, employer_name_raw: d.employerRaw, job_title: 'Officer', since: addMonths(today, -36), salary_basic: d.basic, salary_allowances: d.allowances, social_allowance: d.social, salary_total: d.total, salary_certificate_on: null, salary_bank: d.salaryBank });
    for (const c of d.credits) if (c.amount > 0 || c.reason) g.credits.push({ customer_id: d.id, month: c.month, amount: c.amount, source_tag: c.amount > 0 ? 'SALARY' : 'GAP', credited_on: `${c.month}-25`, employer_ref: d.employerId ?? d.employerRaw ?? null, explained_reason: c.reason ?? null });
    if (d.current) g.accounts.push({ customer_id: d.id, type: 'CURRENT', iban: `QA00DEMO${d.id.replace(/\D/g, '').padStart(18, '0')}`, opened_on: d.joined, status: 'ACTIVE', last_txn_on: addDays(today, -3), balance: Math.round(d.total * 0.4) });
    else if (d.status === 'DORMANT') g.accounts.push({ customer_id: d.id, type: 'CURRENT', iban: `QA00DEMO${d.id.replace(/\D/g, '').padStart(18, '0')}`, opened_on: d.joined, status: 'DORMANT', last_txn_on: addMonths(today, -14), balance: 120 });
    g.accounts.push({ customer_id: d.id, type: 'SAVINGS', iban: `QA00DEMS${d.id.replace(/\D/g, '').padStart(18, '0')}`, opened_on: d.joined, status: 'ACTIVE', last_txn_on: addDays(today, -20), balance: d.savings });
    if (d.deposits > 50000) g.accounts.push({ customer_id: d.id, type: 'DEPOSIT', iban: `QA00DEMD${d.id.replace(/\D/g, '').padStart(18, '0')}`, opened_on: addMonths(today, -10), status: 'ACTIVE', last_txn_on: addMonths(today, -1), balance: d.deposits });
    for (const f of d.facilities) g.facilities.push({ customer_id: d.id, product: f.product, principal: f.principal, outstanding: f.outstanding, repayable: f.repayable, instalment: f.instalment, start_on: f.start, maturity: f.maturity, dpd: f.dpd, dpd_since: f.dpdSince, late_payments_6m: f.late6m, schedule_irregular: f.irregular, restructured_on: f.irregular ? addMonths(today, -4) : null, last_paid_on: f.dpd ? addMonths(today, -2) : addDays(today, -12) });
    for (const c of d.cards) g.cards.push({ customer_id: d.id, card_limit: c.limit, outstanding: c.outstanding, min_due: Math.round(c.outstanding * 0.05), dpd: c.dpd, dpd_since: c.dpdSince, status: 'ACTIVE' });
    for (const s of d.sos) g.sos.push({ customer_id: d.id, beneficiary_type: s.type, beneficiary_name: s.name, amount: s.amount, frequency: 'MONTHLY', customer_classification: null, classified_on: null });
    for (const ch of d.cheques) g.cheques.push({ customer_id: d.id, returned_on: ch.on, amount: ch.amount, settled_on: ch.settled });
    for (const n of d.notes) g.notes.push({ customer_id: d.id, type: n.type, set_on: n.on, set_by: n.by, lifting_condition: n.cond, lifted_on: null, lifted_by: null });
    g.injected.set(d.id, d.injected);
  }
  return g;
}
