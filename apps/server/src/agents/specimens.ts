/**
 * Specimen documents. Every document in the demo is a SPECIMEN rendered from
 * the synthetic record (QID, passport data page with a valid MRZ, salary
 * certificate, HR letter, liability letter, standing-order declaration, bank
 * statement page), watermarked "SPECIMEN · SYNTHETIC · DEMO". Each carries its
 * fields, so the Offline examiner can read it, and its printed text, which
 * the Claude examiner extracts from when the connection is present. Four
 * kinds are deliberately wrong: an expired copy, a different person's card, a
 * name that does not match, an unreadable photo.
 */
import { addMonths, addDays, fmtDate, windowMonths, type DocType } from '@jahiz/domain';
import type { FullFacts } from '../core/connector.js';
import { buildMrz } from './mrz.js';

export type SpecimenKind = 'qid-new' | 'qid-expired-copy' | 'qid-other-person' | 'qid-name-mismatch' | 'qid-unreadable' | 'passport-new' | 'passport-old-copy' | 'salary-cert' | 'salary-cert-elsewhere' | 'hr-letter' | 'liability-letter' | 'so-declaration' | 'bank-statement';
export const SPECIMEN_KINDS: { kind: SpecimenKind; label: string; label_ar: string; type: DocType; flaw: string | null }[] = [
  { kind: 'qid-new', label: 'Renewed Qatar ID (front and back)', label_ar: 'بطاقة شخصية مجددة', type: 'QID', flaw: null },
  { kind: 'passport-new', label: 'Renewed passport (data page)', label_ar: 'جواز سفر مجدد', type: 'PASSPORT', flaw: null },
  { kind: 'salary-cert', label: 'Salary certificate (≤ 30 days)', label_ar: 'شهادة راتب', type: 'SALARY_CERT', flaw: null },
  { kind: 'salary-cert-elsewhere', label: 'Salary certificate — salary paid at another bank', label_ar: 'شهادة راتب — الراتب في بنك آخر', type: 'SALARY_CERT', flaw: null },
  { kind: 'hr-letter', label: 'HR letter explaining a salary gap', label_ar: 'خطاب الموارد البشرية', type: 'HR_LETTER', flaw: null },
  { kind: 'liability-letter', label: 'Liability letter (other-bank finance)', label_ar: 'خطاب الالتزامات', type: 'LIABILITY_LETTER', flaw: null },
  { kind: 'so-declaration', label: 'Standing-order declaration', label_ar: 'إقرار أوامر الدفع', type: 'SO_DECLARATION', flaw: null },
  { kind: 'bank-statement', label: 'Bank statement page (another bank)', label_ar: 'كشف حساب', type: 'BANK_STATEMENT', flaw: null },
  { kind: 'qid-expired-copy', label: 'Old, already-expired QID copy', label_ar: 'نسخة قديمة منتهية', type: 'QID', flaw: 'EXPIRED_COPY' },
  { kind: 'qid-other-person', label: 'A different person\'s QID', label_ar: 'بطاقة شخص آخر', type: 'QID', flaw: 'OTHER_PERSON' },
  { kind: 'qid-name-mismatch', label: 'QID with a name that does not match', label_ar: 'بطاقة باسم غير مطابق', type: 'QID', flaw: 'NAME_MISMATCH' },
  { kind: 'qid-unreadable', label: 'Unreadable photo', label_ar: 'صورة غير مقروءة', type: 'QID', flaw: 'UNREADABLE' },
  { kind: 'passport-old-copy', label: 'Old, expired passport copy', label_ar: 'نسخة جواز قديمة منتهية', type: 'PASSPORT', flaw: 'EXPIRED_COPY' },
];
export const specimenDef = (kind: string) => SPECIMEN_KINDS.find((k) => k.kind === kind);

export type Specimen = { kind: SpecimenKind; type: DocType; flaw: string | null; fields: Record<string, any>; text: string; title: string };

const split = (name: string) => { const parts = name.split(' '); return { given: parts.slice(0, -1).join(' ') || parts[0], surname: parts[parts.length - 1] }; };

/** Build the specimen for a customer (and, for the other-person flaw, another customer's fields). */
export function buildSpecimen(kind: SpecimenKind, f: FullFacts, today: string, other?: FullFacts): Specimen {
  const def = specimenDef(kind)!;
  const { given, surname } = split(f.nameEn);
  const base = { name_en: f.nameEn, name_ar: f.nameAr, dob: f.dob, nationality: f.nationality, sex: f.row.gender === 'F' ? 'F' : 'M' };
  switch (kind) {
    case 'qid-new': case 'qid-name-mismatch': case 'qid-unreadable': case 'qid-expired-copy': case 'qid-other-person': {
      const src = kind === 'qid-other-person' && other ? other : f;
      const expired = kind === 'qid-expired-copy';
      const fields = {
        ...base, name_en: kind === 'qid-name-mismatch' ? `${given} Khalifa` : src.nameEn, name_ar: src.nameAr, dob: src.dob, nationality: src.nationality,
        number: src.qidNumber ?? '2DEMO000000', issued_on: expired ? addMonths(src.qidExpiry ?? today, -36 - 36) : addDays(today, -4), expires_on: expired ? (src.qidExpiry && src.qidExpiry < today ? src.qidExpiry : addMonths(today, -2)) : addMonths(addDays(today, -4), 36),
        occupation: 'See employer record', unreadable: kind === 'qid-unreadable',
      };
      const text = kind === 'qid-unreadable' ? '[image too dark to read: a card edge, a thumb, glare]' : `STATE OF QATAR · دولة قطر\nRESIDENCY PERMIT / QATAR ID\nID. No: ${fields.number}\nName: ${fields.name_en}\nالاسم: ${fields.name_ar}\nD.O.B: ${fields.dob}\nNationality: ${fields.nationality}\nExpiry: ${fields.expires_on}\nIssued: ${fields.issued_on}\n(back) Serial DEMO · Occupation ${fields.occupation}`;
      return { kind, type: 'QID', flaw: def.flaw, fields, text, title: `Qatar ID — ${fields.name_en}` };
    }
    case 'passport-new': case 'passport-old-copy': {
      const old = kind === 'passport-old-copy';
      const number = f.passportNumber ?? 'DEMO12345';
      const expiry = old ? (f.passportExpiry && f.passportExpiry < today ? f.passportExpiry : addMonths(today, -3)) : addMonths(addDays(today, -6), 120);
      const mrz = buildMrz({ surname, given, number, nationality: f.nationality, dob: f.dob, sex: base.sex as any, expiry });
      const fields = { ...base, number, issued_on: old ? addMonths(expiry, -120) : addDays(today, -6), expires_on: expiry, mrz1: mrz.line1, mrz2: mrz.line2, place_of_issue: 'DEMO' };
      const text = `PASSPORT · ${f.nationality}\nType P · Code ${f.nationality}\nPassport No. ${number}\nSurname ${surname.toUpperCase()}\nGiven names ${given.toUpperCase()}\nNationality ${f.nationality}\nDate of birth ${f.dob}\nSex ${base.sex}\nDate of issue ${fields.issued_on}\nDate of expiry ${expiry}\n${mrz.line1}\n${mrz.line2}`;
      return { kind, type: 'PASSPORT', flaw: def.flaw, fields, text, title: `Passport — ${f.nameEn}` };
    }
    case 'salary-cert': case 'salary-cert-elsewhere': {
      const elsewhere = kind === 'salary-cert-elsewhere';
      const fields = { ...base, employer: f.employerName ?? 'Al Wakra Trading & Contracting W.L.L.', employer_id: f.employerId, job_title: 'Senior Officer', since: addMonths(today, -30), salary_basic: f.basic, salary_allowances: f.allowances, salary_total: f.salaryTotal, paid_to_bank: elsewhere ? 'Doha Bank' : 'QIB', dated: addDays(today, -3), ref: `HR/${today.slice(0, 4)}/DEMO-${f.id.slice(-4)}` };
      const text = `${fields.employer}\nTO WHOM IT MAY CONCERN · SALARY CERTIFICATE\nRef ${fields.ref} · Date ${fields.dated}\nThis is to certify that ${f.nameEn} (QID ${f.qidNumber ?? '—'}) is employed with us as ${fields.job_title} since ${fields.since}.\nBasic salary QAR ${fields.salary_basic} · Allowances QAR ${fields.salary_allowances} · Total monthly salary QAR ${fields.salary_total}\nSalary is transferred monthly to ${fields.paid_to_bank}.\nAuthorised signatory · HR Department`;
      return { kind, type: 'SALARY_CERT', flaw: null, fields, text, title: `Salary certificate — ${f.nameEn}` };
    }
    case 'hr-letter': {
      const months = windowMonths(today, 6);
      const gap = f.salaryCredits.length ? months.find((m) => !f.salaryCredits.some((x) => x.month === m && x.amount > 0)) ?? months[3] : months[3];
      const fields = { ...base, employer: f.employerName ?? 'Employer', gap_month: gap, reason: 'UNPAID_LEAVE', reason_text: 'unpaid leave', dated: addDays(today, -2), continuous: true };
      const text = `${fields.employer} · Human Resources\nDate ${fields.dated}\nTo Qatar Islamic Bank\nSubject: Salary for ${fmtDate(gap + '-01').slice(2)}\nWe confirm that ${f.nameEn} was on approved ${fields.reason_text} during ${gap}, during which no salary was paid. Employment is continuous and salary resumed the following month.\nHR Manager`;
      return { kind, type: 'HR_LETTER', flaw: null, fields, text, title: `HR letter — ${f.nameEn}` };
    }
    case 'liability-letter': {
      const fi = f.standingOrders.find((s) => s.type === 'FI');
      const fields = { ...base, bank: 'Doha Bank', outstanding: Math.round((fi?.amount ?? 2000) * 18), instalment: fi?.amount ?? 2000, maturity: addMonths(today, 18), dated: addDays(today, -5) };
      const text = `${fields.bank} · Liability letter\nDate ${fields.dated}\nCustomer ${f.nameEn}\nPersonal finance outstanding QAR ${fields.outstanding}, monthly instalment QAR ${fields.instalment}, maturity ${fields.maturity}. No arrears.\nAuthorised signatory`;
      return { kind, type: 'LIABILITY_LETTER', flaw: null, fields, text, title: `Liability letter — ${f.nameEn}` };
    }
    case 'so-declaration': {
      const orders = f.standingOrders.map((s, i) => ({ index: i + 1, amount: s.amount, declared: s.type === 'FI' ? 'FI' : s.type }));
      const fields = { ...base, orders, dated: today };
      const text = `Standing-order declaration · ${f.nameEn}\n${orders.map((o) => `Order ${o.index}: QAR ${o.amount} — ${o.declared === 'FI' ? 'finance instalment at another bank' : o.declared === 'SCHOOL' ? 'school fees' : o.declared === 'FAMILY' ? 'family support' : o.declared === 'RENT' ? 'rent' : 'other'}`).join('\n')}\nDeclared in the QIB Mobile app on ${today}`;
      return { kind, type: 'SO_DECLARATION', flaw: null, fields, text, title: `Standing-order declaration — ${f.nameEn}` };
    }
    case 'bank-statement': {
      const months = windowMonths(today, 3);
      const fields = { ...base, bank: 'Doha Bank', credits: months.map((m) => ({ month: m, amount: f.salaryTotal, narrative: 'SALARY' })), dated: addDays(today, -1) };
      const text = `${fields.bank} · Account statement · ${f.nameEn}\n${fields.credits.map((c) => `${c.month}-25 SALARY CREDIT QAR ${c.amount}`).join('\n')}\nStatement date ${fields.dated}`;
      return { kind, type: 'BANK_STATEMENT', flaw: null, fields, text, title: `Bank statement — ${f.nameEn}` };
    }
  }
}

const esc = (s: unknown) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const WM = `<g opacity="0.14" transform="rotate(-18 300 190)"><text x="300" y="200" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-weight="800" font-size="34" fill="#831A4B">SPECIMEN · SYNTHETIC · DEMO</text></g>`;

/** Render the specimen as an SVG card (600×380 for cards, 600×760 for letters). */
export function renderSpecimenSvg(s: Specimen): string {
  const t = (x: number, y: number, txt: unknown, size = 13, weight = 400, fill = '#00111A', extra = '') => {
    // `extra` may carry its own font-family (MRZ lines); an attribute must not repeat or the SVG is invalid XML.
    const mono = /font-family=/.test(extra);
    return `<text x="${x}" y="${y}" ${mono ? '' : 'font-family="Inter, Arial, sans-serif" '}font-size="${size}" font-weight="${weight}" fill="${fill}" ${extra}>${esc(txt)}</text>`;
  };
  const f = s.fields;
  if (s.type === 'QID') {
    if (f.unreadable) return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 380" width="600" height="380"><rect width="600" height="380" fill="#1b1f24"/><rect x="40" y="60" width="520" height="260" rx="18" fill="#2a3139"/><ellipse cx="420" cy="120" rx="140" ry="60" fill="#3b4652" opacity="0.6"/><ellipse cx="150" cy="300" rx="120" ry="80" fill="#0e1013" opacity="0.9"/>${t(300, 200, 'image too dark to read', 20, 600, '#9aa5b1', 'text-anchor="middle"')}${WM}</svg>`;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 380" width="600" height="380"><defs><linearGradient id="g" x1="0" x2="1"><stop offset="0" stop-color="#e9e2d0"/><stop offset="1" stop-color="#d9d0b8"/></linearGradient></defs><rect width="600" height="380" rx="22" fill="url(#g)"/><rect x="0" y="0" width="600" height="56" rx="22" fill="#8a1538"/><rect x="0" y="30" width="600" height="26" fill="#8a1538"/>${t(24, 36, 'STATE OF QATAR · دولة قطر', 16, 700, '#fff')}${t(576, 36, 'RESIDENCY PERMIT', 12, 600, '#fff', 'text-anchor="end"')}<rect x="24" y="80" width="130" height="160" rx="8" fill="#c9c0a8"/><circle cx="89" cy="140" r="34" fill="#a79d84"/><rect x="44" y="180" width="90" height="50" rx="25" fill="#a79d84"/>${t(176, 100, 'ID. No', 11, 600, '#6b5e45')}${t(176, 122, f.number, 20, 700)}${t(176, 150, 'Name', 11, 600, '#6b5e45')}${t(176, 170, f.name_en, 16, 600)}${t(576, 170, f.name_ar, 16, 600, '#00111A', 'text-anchor="end"')}${t(176, 200, 'D.O.B.', 11, 600, '#6b5e45')}${t(176, 218, f.dob, 14, 600)}${t(300, 200, 'Nationality', 11, 600, '#6b5e45')}${t(300, 218, f.nationality, 14, 600)}${t(430, 200, 'Expiry', 11, 600, '#6b5e45')}${t(430, 218, f.expires_on, 14, 700, s.flaw === 'EXPIRED_COPY' ? '#9a1b1b' : '#00111A')}${t(24, 290, `Issued ${f.issued_on} · Serial DEMO · ${f.occupation}`, 11, 400, '#6b5e45')}<rect x="24" y="310" width="552" height="40" rx="6" fill="#c9c0a8"/>${t(36, 336, 'IDQAT' + String(f.number).replace(/\D/g, '').padEnd(24, '<') + '<<<<<<<<<', 15, 500, '#1a1a1a', 'font-family="ui-monospace, Menlo, monospace" letter-spacing="1"')}${WM}</svg>`;
  }
  if (s.type === 'PASSPORT') {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 420" width="600" height="420"><rect width="600" height="420" fill="#f3efe6"/><rect x="0" y="0" width="600" height="46" fill="#1f3a5f"/>${t(24, 30, `PASSPORT · ${f.nationality}`, 15, 700, '#fff')}${t(576, 30, 'DATA PAGE', 11, 600, '#dbe6f4', 'text-anchor="end"')}<rect x="24" y="70" width="120" height="150" rx="6" fill="#d8d2c4"/><circle cx="84" cy="125" r="30" fill="#b8b0a0"/>${t(170, 88, 'Type / Code / Passport No.', 10, 600, '#5b6775')}${t(170, 108, `P   ${f.nationality}   ${f.number}`, 15, 700)}${t(170, 136, 'Surname / Given names', 10, 600, '#5b6775')}${t(170, 156, f.name_en, 15, 600)}${t(170, 184, 'Nationality / Date of birth / Sex', 10, 600, '#5b6775')}${t(170, 204, `${f.nationality}   ${f.dob}   ${f.sex}`, 14, 600)}${t(170, 232, 'Date of issue / Date of expiry', 10, 600, '#5b6775')}${t(170, 252, `${f.issued_on}   ${f.expires_on}`, 14, 700, s.flaw === 'EXPIRED_COPY' ? '#9a1b1b' : '#00111A')}<rect x="24" y="300" width="552" height="90" rx="4" fill="#fff"/>${t(36, 338, f.mrz1, 17, 500, '#111', 'font-family="ui-monospace, Menlo, monospace" letter-spacing="1.5"')}${t(36, 372, f.mrz2, 17, 500, '#111', 'font-family="ui-monospace, Menlo, monospace" letter-spacing="1.5"')}${WM}</svg>`;
  }
  // Letters and statements: an A4-ish page
  const lines = s.text.split('\n');
  const body = lines.map((l, i) => t(48, 120 + i * 26, l, i === 0 ? 15 : 13, i === 0 ? 700 : 400, i === 0 ? '#002E5E' : '#1a1a1a')).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 ${Math.max(420, 160 + lines.length * 26)}" width="600" height="${Math.max(420, 160 + lines.length * 26)}"><rect width="600" height="100%" fill="#ffffff"/><rect x="0" y="0" width="600" height="70" fill="#eef3f7"/>${t(48, 44, s.fields.employer ?? s.fields.bank ?? 'Letterhead (fictional)', 14, 700, '#002E5E')}${t(552, 44, 'DEMO LETTERHEAD', 10, 600, '#4A5A68', 'text-anchor="end"')}${body}<g opacity="0.14" transform="rotate(-18 300 260)"><text x="300" y="270" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-weight="800" font-size="34" fill="#831A4B">SPECIMEN · SYNTHETIC · DEMO</text></g></svg>`;
}
