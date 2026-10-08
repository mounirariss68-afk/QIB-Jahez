/**
 * The named edge cases (DESIGN §11): each is a scenario step or an inbox item,
 * never a coincidence. They occupy DEMO-C-00001 … and are replayed through
 * the real engine on the virtual clock by history.ts, so every message,
 * block and approval in their history is a genuine engine output.
 */
import { addDays, addMonths, windowMonths, type Policy } from '@jahiz/domain';
import type { Draft } from './base.js';

export type ReplayAction =
  | { kind: 'scan' } | { kind: 'upload'; specimen: string; assurance?: 'APP_UPLOAD' | 'RM_SCAN' } | { kind: 'reply'; text: string } | { kind: 'email'; subject: string; body: string; specimen?: string }
  | { kind: 'decide'; persona: 'supervisor' | 'credit' | 'compliance' | 'rm' | 'ops' | 'head' | 'collections'; decision: 'APPROVED' | 'REJECTED'; reason?: string; edits?: Record<string, any> }
  | { kind: 'plant_offer'; type: 'OFFER' | 'CURRENT_ACCOUNT_OFFER'; channel: 'PUSH' | 'INAPP'; amount?: number }
  | { kind: 'upgrade_segment'; to: 'HNWI'; salary: number; rm: string } | { kind: 'dpd_start'; what: 'FACILITY' | 'CARD' } | { kind: 'fire_tasks' };
export type Edge = { key: string; id: string; title: string; apply: (d: Draft, today: string, policy: Policy) => void; replay: { day: number; action: ReplayAction }[] };

const clean = (d: Draft, today: string) => {
  d.status = 'NORMAL'; d.segmentTag = null; d.notes = []; d.cheques = []; d.current = true; d.modelScore = 0.78; d.rating = 'A'; d.autoIjara = 0.7; d.injected = [];
  d.qid.expires = addMonths(today, 20); d.qid.issued = addMonths(d.qid.expires, -36);
  if (d.passport) { d.passport.expires = addMonths(today, 40); d.passport.issued = addMonths(today, -20); }
  d.employerId = 'DEMO-E-004'; d.employerRaw = null; d.salaryBank = 'QIB';
  d.credits = windowMonths(today, 12).map((m) => ({ month: m, amount: d.total }));
  d.sos = d.sos.filter((s) => s.type !== 'FI');
  d.facilities = []; d.cards = [];
  d.dnc = false; d.optouts = [];
};
const resident = (d: Draft, today: string, nat = 'IND', nameEn?: string, nameAr?: string) => { d.isQatari = false; d.nationality = nat; d.privateBanking = false; if (!d.passport) d.passport = { number: `${nat[0]}${d.id.slice(-7).replace(/\D/g, '').padStart(7, '1')}`, issued: addMonths(today, -20), expires: addMonths(today, 40) }; if (nameEn) { d.nameEn = nameEn; d.nameAr = nameAr ?? nameAr!; } d.lang = 'en'; };
const qatari = (d: Draft, today: string, nameEn: string, nameAr: string) => { d.isQatari = true; d.nationality = 'QAT'; d.passport = null; d.nameEn = nameEn; d.nameAr = nameAr; d.lang = 'ar'; };
const salary = (d: Draft, total: number, today: string) => { d.total = total; d.social = d.isQatari ? Math.min(4000, Math.round(total * 0.2)) : 0; d.basic = Math.round((total - d.social) * 0.6); d.allowances = total - d.social - d.basic; d.credits = windowMonths(today, 12).map((m) => ({ month: m, amount: total })); };
const mass = (d: Draft) => { d.segment = 'MASS'; d.privateBanking = false; d.rmId = null; d.deposits = 12000; };
const age = (d: Draft, years: number, months: number, today: string) => { d.dob = addMonths(today, -(years * 12 + months)); };

export const EDGES: Edge[] = [
  { key: 'EC01', id: 'DEMO-C-00001', title: 'Mass resident, QID expired 61 days ago; two notices unanswered', apply: (d, t) => { clean(d, t); resident(d, t, 'IND', 'Rajesh Kumar Nair', 'راجيش كومار ناير'); mass(d); salary(d, 9500, t); d.app = true; d.push = true; d.marketing = true; d.qid.expires = addDays(t, -61); d.qid.issued = addMonths(d.qid.expires, -36); d.injected = ['R07']; },
    replay: [{ day: -60, action: { kind: 'scan' } }] },
  { key: 'EC02', id: 'DEMO-C-00002', title: 'Mass resident, QID expired 8 days ago; uploads the renewed QID today', apply: (d, t) => { clean(d, t); resident(d, t, 'EGY', 'Omar Tarek Haddad', 'عمر طارق حداد'); mass(d); salary(d, 11000, t); d.lang = 'ar'; d.app = true; d.push = true; d.marketing = true; d.qid.expires = addDays(t, -8); d.qid.issued = addMonths(d.qid.expires, -36); d.injected = ['R07']; },
    replay: [{ day: -7, action: { kind: 'scan' } }] },
  { key: 'EC03', id: 'DEMO-C-00003', title: 'High Value resident, salary missing in July (unpaid leave)', apply: (d, t) => { clean(d, t); resident(d, t, 'JOR', 'Rami Samer Mansour', 'رامي سامر منصور'); d.segment = 'HIGH_VALUE'; d.rmId = null; d.privateBanking = false; d.deposits = 90000; salary(d, 32000, t); d.employerId = 'DEMO-E-008'; const july = windowMonths(t, 6)[3]; d.credits.find((c) => c.month === july)!.amount = 0; d.app = true; d.push = true; d.marketing = true; d.injected = ['R01']; },
    replay: [{ day: -6, action: { kind: 'scan' } }] },
  { key: 'EC04', id: 'DEMO-C-00004', title: 'Mass resident, salary moved to another bank since May; consent on file', apply: (d, t) => { clean(d, t); resident(d, t, 'PHL', 'Maria Grace Santos', 'ماريا غريس سانتوس'); mass(d); salary(d, 7500, t); const w = windowMonths(t, 6); for (const m of w.slice(1)) d.credits.find((c) => c.month === m)!.amount = 0; d.salaryBank = 'QIB'; d.app = true; d.push = true; d.marketing = true; d.injected = ['R01']; },
    replay: [{ day: -20, action: { kind: 'scan' } }, { day: -15, action: { kind: 'upload', specimen: 'salary-cert-elsewhere' } }, { day: -14, action: { kind: 'decide', persona: 'supervisor', decision: 'APPROVED', reason: 'Certificate verified; salary paid at Doha Bank' } }] },
  { key: 'EC05', id: 'DEMO-C-00005', title: 'Employer DEMO-E-047 unapproved with 14 QIB-salaried staff', apply: (d, t) => { clean(d, t); resident(d, t, 'PAK', 'Bilal Imran Khan', 'بلال عمران خان'); mass(d); salary(d, 14500, t); d.employerId = 'DEMO-E-047'; d.app = true; d.push = true; d.marketing = true; d.injected = ['R02']; },
    replay: [{ day: -60, action: { kind: 'scan' } }] },
  { key: 'EC06', id: 'DEMO-C-00006', title: 'Employer missing on the record (migration gap)', apply: (d, t) => { clean(d, t); resident(d, t, 'NPL', 'Dinesh Thapa', 'دينيش ثابا'); mass(d); salary(d, 5200, t); d.employerId = null; d.employerRaw = 'Al Wakra Trading'; d.app = true; d.push = true; d.marketing = false; d.injected = ['R02']; },
    replay: [{ day: -60, action: { kind: 'scan' } }] },
  { key: 'EC07', id: 'DEMO-C-00007', title: 'Client upgraded to Tamayuz after the Mass notice sequence was scheduled', apply: (d, t) => { clean(d, t); qatari(d, t, 'Jassim Nasser Al-Kuwari', 'جاسم ناصر الكواري'); mass(d); salary(d, 18500, t); d.app = false; d.push = false; d.marketing = true; d.qid.expires = addDays(t, -10); d.qid.issued = addMonths(d.qid.expires, -36); d.injected = ['R07']; },
    replay: [{ day: -9, action: { kind: 'scan' } }, { day: -5, action: { kind: 'upgrade_segment', to: 'HNWI', salary: 55000, rm: 'DEMO-RM-01' } }] },
  { key: 'EC08', id: 'DEMO-C-00008', title: 'VVIP Private Banking client, passport expiring in 40 days', apply: (d, t) => { clean(d, t); resident(d, t, 'GBR', 'James Walker', 'جيمس ووكر'); d.segment = 'VVIP'; d.privateBanking = true; d.rmId = 'DEMO-RM-01'; d.deposits = 3_200_000; salary(d, 95000, t); d.passport!.expires = addDays(t, 40); d.app = true; d.push = true; d.marketing = false; d.injected = []; },
    replay: [{ day: -50, action: { kind: 'scan' } }] },
  { key: 'EC09', id: 'DEMO-C-00009', title: 'Three standing orders counted as finance; a declaration reclassifies two', apply: (d, t) => { clean(d, t); qatari(d, t, 'Hamad Saad Al-Marri', 'حمد سعد المري'); mass(d); salary(d, 16000, t); d.sos = [{ type: 'FI', name: 'Doha International School', amount: 2500 }, { type: 'FI', name: 'Standing transfer', amount: 2000 }, { type: 'FI', name: 'Commercial Bank', amount: 1800 }]; d.app = true; d.push = true; d.marketing = true; d.injected = ['R04']; },
    replay: [{ day: -8, action: { kind: 'scan' } }] },
  { key: 'EC10', id: 'DEMO-C-00010', title: 'Qatari at QAR 1.95m exposure; headroom at the next maturity', apply: (d, t) => { clean(d, t); qatari(d, t, 'Khalid Mohammed Al-Attiyah', 'خالد محمد العطية'); d.segment = 'HIGH_VALUE'; d.rmId = null; d.privateBanking = false; d.deposits = 150000; salary(d, 45000, t); d.facilities = [{ product: 'HOME', principal: 1_900_000, outstanding: 1_500_000, repayable: 1_690_000, instalment: 11200, start: addMonths(t, -36), maturity: addMonths(t, 150), dpd: 0, dpdSince: null, late6m: 0, irregular: false }, { product: 'AUTO_IJARA', principal: 280_000, outstanding: 240_000, repayable: 260_000, instalment: 7800, start: addMonths(t, -33), maturity: addMonths(t, 3), dpd: 0, dpdSince: null, late6m: 0, irregular: false }]; d.cards = []; d.app = true; d.push = true; d.marketing = true; d.injected = ['R03']; },
    replay: [{ day: -60, action: { kind: 'scan' } }] },
  { key: 'EC11', id: 'DEMO-C-00011', title: 'Cautionary note COURT_ATTACHMENT', apply: (d, t) => { clean(d, t); resident(d, t, 'SYR', 'Firas Ayman Darwish', 'فراس أيمن درويش'); mass(d); salary(d, 12000, t); d.notes = [{ type: 'COURT_ATTACHMENT', on: addDays(t, -40), by: 'Legal', cond: 'Discharge certificate from the court' }]; d.app = true; d.push = true; d.marketing = true; d.injected = ['R05']; },
    replay: [{ day: -39, action: { kind: 'scan' } }] },
  { key: 'EC12', id: 'DEMO-C-00012', title: 'Cautionary note KYC_EXPIRED, reclassified to WF-02 by Compliance', apply: (d, t) => { clean(d, t); resident(d, t, 'EGY', 'Mahmoud Hossam Saleh', 'محمود حسام صالح'); mass(d); salary(d, 8800, t); d.lang = 'ar'; d.notes = [{ type: 'KYC_EXPIRED', on: addDays(t, -70), by: 'KYC Unit', cond: 'Valid identity document on file' }]; d.qid.expires = addDays(t, -75); d.qid.issued = addMonths(d.qid.expires, -36); d.app = true; d.push = true; d.marketing = true; d.injected = ['R05', 'R07']; },
    replay: [{ day: -60, action: { kind: 'scan' } }, { day: -20, action: { kind: 'decide', persona: 'compliance', decision: 'APPROVED', reason: 'KYC-expired note is remediable: reclassified to the QID refresh workflow', edits: { reclassify: true } } }] },
  { key: 'EC13', id: 'DEMO-C-00013', title: 'Dormant savings-only customer; consent-gated current-account offer', apply: (d, t) => { clean(d, t); resident(d, t, 'LKA', 'Nadia Perera', 'نادية بيريرا'); mass(d); salary(d, 6500, t); d.status = 'DORMANT'; d.current = false; d.app = true; d.push = true; d.marketing = true; d.injected = ['R13', 'R08']; },
    replay: [{ day: -30, action: { kind: 'scan' } }] },
  { key: 'EC14', id: 'DEMO-C-00014', title: 'Finance facility at 9 DPD; paid during the demo', apply: (d, t) => { clean(d, t); resident(d, t, 'BGD', 'Rafiq Chowdhury', 'رفيق شودري'); mass(d); salary(d, 7200, t); d.facilities = [{ product: 'PERSONAL', principal: 45000, outstanding: 31000, repayable: 33500, instalment: 1150, start: addMonths(t, -10), maturity: addMonths(t, 29), dpd: 0, dpdSince: null, late6m: 0, irregular: false }]; d.app = true; d.push = true; d.marketing = true; d.injected = ['R15']; },
    replay: [{ day: -9, action: { kind: 'dpd_start', what: 'FACILITY' } }, { day: -8, action: { kind: 'scan' } }] },
  { key: 'EC15', id: 'DEMO-C-00015', title: 'Card at 45 DPD; handed over to Collections; a queued One Click push is blocked', apply: (d, t) => { clean(d, t); resident(d, t, 'IND', 'Suresh Menon', 'سوريش مينون'); mass(d); salary(d, 13000, t); d.cards = [{ limit: 30000, outstanding: 14200, dpd: 0, dpdSince: null }]; d.app = true; d.push = true; d.marketing = true; d.injected = ['R16']; },
    replay: [{ day: -45, action: { kind: 'dpd_start', what: 'CARD' } }, { day: -44, action: { kind: 'scan' } }, { day: -14, action: { kind: 'scan' } }, { day: -1, action: { kind: 'plant_offer', type: 'OFFER', channel: 'PUSH', amount: 95000 } }] },
  { key: 'EC16', id: 'DEMO-C-00016', title: 'Returned cheque settled March 2026; suppressed until March 2029', apply: (d, t) => { clean(d, t); qatari(d, t, 'Faisal Rashid Al-Naimi', 'فيصل راشد النعيمي'); d.segment = 'HNWI'; d.rmId = 'DEMO-RM-01'; d.privateBanking = false; d.deposits = 420000; salary(d, 52000, t); d.cheques = [{ on: '2026-02-20', amount: 48000, settled: '2026-03-15' }]; d.app = true; d.push = true; d.marketing = true; d.injected = ['R17']; },
    replay: [{ day: -60, action: { kind: 'scan' } }] },
  { key: 'EC17', id: 'DEMO-C-00017', title: 'Mass customer who replies STOP; a queued offer push is blocked, the service e-mail goes', apply: (d, t) => { clean(d, t); resident(d, t, 'IND', 'Anil Sharma', 'أنيل شارما'); mass(d); salary(d, 10500, t); d.qid.expires = addDays(t, -12); d.qid.issued = addMonths(d.qid.expires, -36); d.app = true; d.push = true; d.marketing = true; d.injected = ['R07']; },
    replay: [{ day: -11, action: { kind: 'scan' } }, { day: -1, action: { kind: 'plant_offer', type: 'CURRENT_ACCOUNT_OFFER', channel: 'PUSH' } }] },
  { key: 'EC18', id: 'DEMO-C-00018', title: 'E-mailed QID belongs to a different person', apply: (d, t) => { clean(d, t); resident(d, t, 'PAK', 'Tariq Siddiqui', 'طارق صديقي'); mass(d); salary(d, 9800, t); d.qid.expires = addDays(t, -20); d.qid.issued = addMonths(d.qid.expires, -36); d.app = false; d.push = false; d.marketing = true; d.injected = ['R07']; },
    replay: [{ day: -19, action: { kind: 'scan' } }] },
  { key: 'EC19', id: 'DEMO-C-00019', title: 'Uploaded passport is an old, expired copy', apply: (d, t) => { clean(d, t); resident(d, t, 'EGY', 'Dina Karim Nasr', 'دينا كريم نصر'); d.gender = 'F'; mass(d); salary(d, 9000, t); d.lang = 'ar'; d.passport!.expires = addDays(t, -15); d.passport!.issued = addMonths(d.passport!.expires, -120); d.app = true; d.push = true; d.marketing = true; d.injected = ['R06']; },
    replay: [{ day: -14, action: { kind: 'scan' } }, { day: -3, action: { kind: 'upload', specimen: 'passport-old-copy' } }] },
  { key: 'EC20', id: 'DEMO-C-00020', title: 'Resident aged 59 years 8 months: four months to the age limit', apply: (d, t) => { clean(d, t); resident(d, t, 'IND', 'Prasad Iyer', 'براساد آير'); d.segment = 'HIGH_VALUE'; d.rmId = null; d.privateBanking = false; d.deposits = 110000; salary(d, 28000, t); age(d, 59, 8, t); d.app = true; d.push = true; d.marketing = true; d.injected = ['R10']; },
    replay: [{ day: -60, action: { kind: 'scan' } }] },
  { key: 'EC21', id: 'DEMO-C-00021', title: 'Restricted nationality (illustrative code)', apply: (d, t) => { clean(d, t); resident(d, t, 'XR1', 'Daniel Hughes', 'دانيال هيوز'); mass(d); salary(d, 15000, t); d.app = true; d.push = true; d.marketing = true; d.injected = ['R11']; },
    replay: [{ day: -60, action: { kind: 'scan' } }] },
  { key: 'EC22', id: 'DEMO-C-00022', title: 'Mass case with reminders scheduled (policy-change effect preview)', apply: (d, t) => { clean(d, t); resident(d, t, 'NPL', 'Kamal Gurung', 'كمال غورونغ'); mass(d); salary(d, 6800, t); d.qid.expires = addDays(t, -6); d.qid.issued = addMonths(d.qid.expires, -36); d.app = true; d.push = true; d.marketing = true; d.injected = ['R07']; },
    replay: [{ day: -5, action: { kind: 'scan' } }] },
  { key: 'EC23', id: 'DEMO-C-00023', title: 'Customer e-mails "I lost my job last month": hardship', apply: (d, t) => { clean(d, t); resident(d, t, 'PHL', 'Joel Reyes', 'جويل رييس'); mass(d); salary(d, 8200, t); const w = windowMonths(t, 6); for (const m of w.slice(3)) d.credits.find((c) => c.month === m)!.amount = 0; d.app = true; d.push = true; d.marketing = true; d.injected = ['R01']; },
    replay: [{ day: -12, action: { kind: 'scan' } }, { day: -2, action: { kind: 'email', subject: 'Re: salary certificate', body: 'I lost my job last month and I cannot provide a salary certificate right now. I am looking for work and will update you.' } }] },
  { key: 'EC24', id: 'DEMO-C-00024', title: 'Customer reply classed as a complaint', apply: (d, t) => { clean(d, t); resident(d, t, 'LBN', 'Ziad Bassem Khoury', 'زياد باسم خوري'); mass(d); salary(d, 12500, t); d.qid.expires = addDays(t, -11); d.qid.issued = addMonths(d.qid.expires, -36); d.app = true; d.push = true; d.marketing = true; d.injected = ['R07']; },
    replay: [{ day: -10, action: { kind: 'scan' } }, { day: -1, action: { kind: 'reply', text: 'This is unacceptable. I already sent my ID to the branch twice and I keep getting these messages. I want to complain.' } }] },
  // Extras that give the inbox and the dashboard their texture
  { key: 'EC21B', id: 'DEMO-C-00025', title: 'Staff account (ineligible segment)', apply: (d, t) => { clean(d, t); qatari(d, t, 'Moza Hamad Al-Mannai', 'موزة حمد المناعي'); d.gender = 'F'; mass(d); salary(d, 17000, t); d.segmentTag = 'STAFF'; d.injected = ['R18']; }, replay: [{ day: -60, action: { kind: 'scan' } }] },
  { key: 'EC06B', id: 'DEMO-C-00026', title: 'Employer missing; replies with a salary certificate', apply: (d, t) => { clean(d, t); resident(d, t, 'IND', 'Vikram Reddy', 'فيكرام ريدي'); mass(d); salary(d, 7000, t); d.employerId = null; d.employerRaw = null; d.app = true; d.push = true; d.marketing = true; d.injected = ['R02']; },
    replay: [{ day: -60, action: { kind: 'scan' } }, { day: -40, action: { kind: 'upload', specimen: 'salary-cert' } }, { day: -39, action: { kind: 'decide', persona: 'supervisor', decision: 'APPROVED', reason: 'Employer matched on the register' } }] },
  { key: 'EC02B', id: 'DEMO-C-00027', title: 'HNWI client, RM collects the scan (RM-approved path)', apply: (d, t) => { clean(d, t); qatari(d, t, 'Noora Ali Al-Sulaiti', 'نورة علي السليطي'); d.gender = 'F'; d.segment = 'HNWI'; d.rmId = 'DEMO-RM-01'; d.privateBanking = false; d.deposits = 500000; salary(d, 62000, t); d.qid.expires = addDays(t, -25); d.qid.issued = addMonths(d.qid.expires, -36); d.app = true; d.push = true; d.marketing = true; d.injected = ['R07']; },
    replay: [{ day: -24, action: { kind: 'scan' } }] },
];

/** 13 more customers for employer DEMO-E-047 so the leverage case counts 14. */
export const E047_EXTRA_IDS = Array.from({ length: 13 }, (_, i) => `DEMO-C-${String(28 + i).padStart(5, '0')}`);
export function applyE047(d: Draft, today: string) { clean(d, today); d.segment = d.segment === 'VVIP' || d.segment === 'HNWI' ? 'HIGH_VALUE' : d.segment; d.privateBanking = false; d.rmId = null; d.employerId = 'DEMO-E-047'; d.injected = ['R02']; if (d.total > 48000) salary(d, 30000, today); }
