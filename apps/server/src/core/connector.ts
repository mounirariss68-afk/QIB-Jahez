/**
 * The core connector: the ONLY module that reads or writes the `core` schema
 * (the simulated QIB customer database). Every call is logged to
 * layer.integration_log in the dialect the core banking API would use
 * (resource, verb, record, duration), so the demo shows exactly what Jahiz
 * would ask of the real systems. Channel, One Click, bureau and Anthropic
 * calls are logged here too (`external`).
 */
import type { CustomerFacts, EmployerStatus } from '@jahiz/domain';
import type { Q } from '../db.js';
import { now } from '../clock.js';

export type Ctx = { c: Q; actor: string; runId?: number | null };
export type System = 'CORE' | 'CHANNEL' | 'ONECLICK' | 'BUREAU' | 'ANTHROPIC' | 'GRAPH';

export async function log(ctx: Ctx, system: System, direction: 'IN' | 'OUT', verb: string, resource: string, status: number, note?: string, ms?: number) {
  await ctx.c.query(`INSERT INTO layer.integration_log (at, system, direction, verb, resource, status, note, ms, actor, run_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
    [now(), system, direction, verb, resource, status, note ?? null, ms ?? null, ctx.actor, ctx.runId ?? null]);
}
export const external = (ctx: Ctx, system: System, verb: string, resource: string, note?: string, status = 200) => log(ctx, system, 'OUT', verb, resource, status, note);

async function timed<T>(ctx: Ctx, verb: string, resource: string, fn: () => Promise<T>, note?: string): Promise<T> {
  const t0 = Date.now();
  try { const out = await fn(); await log(ctx, 'CORE', 'OUT', verb, resource, 200, note, Date.now() - t0); return out; }
  catch (e: any) { await log(ctx, 'CORE', 'OUT', verb, resource, 500, e.message, Date.now() - t0); throw e; }
}
export const read = <T = any>(ctx: Ctx, resource: string, sql: string, params: unknown[] = [], note?: string) => timed(ctx, 'GET', resource, async () => (await ctx.c.query<T>(sql, params)).rows, note);
export const write = (ctx: Ctx, verb: 'PATCH' | 'POST' | 'DELETE', resource: string, sql: string, params: unknown[] = [], note?: string) => timed(ctx, verb, resource, async () => (await ctx.c.query(sql, params)).rows, note);

// ------------------------------------------------------------------ customer facts

export type CustomerRow = {
  id: string; rim_no: string; name_en: string; name_ar: string; dob: string; gender: string; nationality: string; is_qatari: boolean; segment: any; segment_tag: string | null;
  private_banking: boolean; rm_id: string | null; status: any; status_since: string | null; language_pref: 'en' | 'ar'; joined_on: string; risk_rating: string; internal_rating: string;
  model_score: number; auto_ijara_score: number; deposits: number; card_restricted: boolean;
};
export type FullFacts = CustomerFacts & {
  row: CustomerRow; nameEn: string; nameAr: string; lang: 'en' | 'ar'; rmId: string | null; rimNo: string;
  contact: { mobile: string; email: string; app_registered: boolean; push_enabled: boolean; last_app_login: string | null } | null;
  consent: { marketing_consent: boolean; channel_optouts: string[]; dnc: boolean; dnc_reason: string | null };
  qidNumber: string | null; passportNumber: string | null; employerName: string | null; salaryBank: string; deposits: number; cardRestricted: boolean;
};

const group = <T extends { customer_id: string }>(rows: T[]) => { const m = new Map<string, T[]>(); for (const r of rows) { const a = m.get(r.customer_id); if (a) a.push(r); else m.set(r.customer_id, [r]); } return m; };

/** Load facts for all customers (the scan) or for a list of ids. */
export async function loadFacts(ctx: Ctx, ids?: string[]): Promise<Map<string, FullFacts>> {
  const where = ids ? `WHERE c.id = ANY($1)` : '';
  const p = ids ? [ids] : [];
  const w2 = ids ? `WHERE customer_id = ANY($1)` : '';
  const customers = await read<CustomerRow>(ctx, '/customers', `SELECT c.* FROM core.customers c ${where} ORDER BY c.id`, p, ids ? `${ids.length} customer(s)` : 'full base');
  const docs = await read(ctx, '/identity-documents', `SELECT * FROM core.identity_documents ${w2} ${ids ? 'AND' : 'WHERE'} current`, p);
  const contacts = await read(ctx, '/contacts', `SELECT * FROM core.contacts ${w2}`, p);
  const consents = await read(ctx, '/consents', `SELECT * FROM core.consents ${w2}`, p);
  const employment = await read(ctx, '/employment', `SELECT * FROM core.employment ${w2}`, p);
  const employers = await read(ctx, '/employers', `SELECT id, name_en, approval_status FROM core.employers`);
  const credits = await read(ctx, '/salary-credits', `SELECT * FROM core.salary_credits ${w2}`, p);
  const accounts = await read(ctx, '/accounts', `SELECT * FROM core.accounts ${w2}`, p);
  const facilities = await read(ctx, '/finance-facilities', `SELECT * FROM core.finance_facilities ${w2}`, p);
  const cards = await read(ctx, '/cards', `SELECT * FROM core.cards ${w2}`, p);
  const sos = await read(ctx, '/standing-orders', `SELECT * FROM core.standing_orders ${w2}`, p);
  const cheques = await read(ctx, '/cheques-returned', `SELECT * FROM core.cheques_returned ${w2}`, p);
  const notes = await read(ctx, '/cautionary-notes', `SELECT * FROM core.cautionary_notes ${w2}`, p);
  const gd = group(docs), gc = new Map(contacts.map((x: any) => [x.customer_id, x])), gs = new Map(consents.map((x: any) => [x.customer_id, x])), ge = new Map(employment.map((x: any) => [x.customer_id, x]));
  const emp = new Map(employers.map((x: any) => [x.id, x]));
  const gcr = group(credits), ga = group(accounts), gf = group(facilities), gk = group(cards), gso = group(sos), gch = group(cheques), gn = group(notes);
  const out = new Map<string, FullFacts>();
  for (const r of customers) {
    const d = gd.get(r.id) ?? []; const qid = d.find((x: any) => x.type === 'QID'); const pp = d.find((x: any) => x.type === 'PASSPORT');
    const e = ge.get(r.id); const er = e?.employer_id ? emp.get(e.employer_id) : null; const ct = gc.get(r.id) ?? null; const cs = gs.get(r.id);
    const cr = (gcr.get(r.id) ?? []) as any[];
    out.set(r.id, {
      row: r, id: r.id, isQatari: r.is_qatari, dob: r.dob, nationality: r.nationality, segment: r.segment, status: r.status, segmentTag: r.segment_tag,
      nameEn: r.name_en, nameAr: r.name_ar, lang: r.language_pref, rmId: r.rm_id, rimNo: r.rim_no, deposits: r.deposits, cardRestricted: r.card_restricted,
      basic: e?.salary_basic ?? 0, allowances: e?.salary_allowances ?? 0, socialAllowance: e?.social_allowance ?? 0, salaryTotal: e?.salary_total ?? 0,
      salaryCredits: cr.filter((x) => x.source_tag === 'SALARY').map((x) => ({ month: x.month, amount: x.amount })),
      explainedGaps: cr.filter((x) => x.explained_reason).map((x) => x.month),
      employerId: e?.employer_id ?? null, employerStatus: (er?.approval_status as EmployerStatus) ?? null, employerName: er?.name_en ?? e?.employer_name_raw ?? null, salaryBank: e?.salary_bank ?? 'QIB',
      qidExpiry: qid?.expires_on ?? null, passportExpiry: pp?.expires_on ?? null, qidNumber: qid?.number ?? null, passportNumber: pp?.number ?? null,
      hasCurrentAccount: (ga.get(r.id) ?? []).some((a: any) => a.type === 'CURRENT' && a.status === 'ACTIVE'),
      facilities: (gf.get(r.id) ?? []).map((x: any) => ({ product: x.product, instalment: x.instalment, outstanding: x.outstanding, repayable: x.repayable, dpd: x.dpd, late6m: x.late_payments_6m, irregular: x.schedule_irregular })),
      cards: (gk.get(r.id) ?? []).map((x: any) => ({ limit: x.card_limit, outstanding: x.outstanding, dpd: x.dpd })),
      standingOrders: (gso.get(r.id) ?? []).map((x: any) => ({ type: x.beneficiary_type, amount: x.amount, classified: x.customer_classification })),
      returnedCheques: (gch.get(r.id) ?? []).map((x: any) => ({ returnedOn: x.returned_on, settledOn: x.settled_on })),
      notes: (gn.get(r.id) ?? []).map((x: any) => ({ type: x.type, lifted: !!x.lifted_on })),
      modelScore: Number(r.model_score), rating: r.internal_rating, autoIjaraScore: Number(r.auto_ijara_score),
      contact: ct ? { mobile: ct.mobile, email: ct.email, app_registered: ct.app_registered, push_enabled: ct.push_enabled, last_app_login: ct.last_app_login } : null,
      consent: cs ? { marketing_consent: cs.marketing_consent, channel_optouts: cs.channel_optouts ?? [], dnc: cs.dnc, dnc_reason: cs.dnc_reason } : { marketing_consent: false, channel_optouts: [], dnc: false, dnc_reason: null },
    });
  }
  return out;
}
export async function factsOf(ctx: Ctx, id: string): Promise<FullFacts> {
  const f = (await loadFacts(ctx, [id])).get(id);
  if (!f) throw new Error(`Customer ${id} not found`);
  return f;
}

// ------------------------------------------------------------------ record writes (Muhaddith only)

export type UpdateTarget = 'identity_documents.QID' | 'identity_documents.PASSPORT' | 'employment' | 'contacts' | 'standing_orders' | 'customers' | 'accounts' | 'salary_credits' | 'employers' | 'cautionary_notes' | 'consents';

/** Apply one approved field update. Returns the before value. */
export async function applyUpdate(ctx: Ctx, customerId: string, target: string, field: string, newValue: string | null, note?: string): Promise<string | null> {
  const at = now().toISOString().slice(0, 10);
  if (target === 'identity_documents.QID' || target === 'identity_documents.PASSPORT') {
    const type = target.split('.')[1];
    const cur = (await ctx.c.query(`SELECT * FROM core.identity_documents WHERE customer_id=$1 AND type=$2 AND current`, [customerId, type])).rows[0];
    if (field === 'renew') {
      // newValue = JSON {number, expires_on, issued_on, source}
      const v = JSON.parse(newValue ?? '{}');
      await write(ctx, 'PATCH', `/customers/${customerId}/identity-documents/${type}`, `UPDATE core.identity_documents SET current=FALSE WHERE customer_id=$1 AND type=$2`, [customerId, type], note);
      await write(ctx, 'POST', `/customers/${customerId}/identity-documents`, `INSERT INTO core.identity_documents (customer_id, type, number, issued_on, expires_on, verified_on, source, current, image_ref) VALUES ($1,$2,$3,$4,$5,$6,$7,TRUE,$8)`,
        [customerId, type, v.number, v.issued_on ?? null, v.expires_on, at, v.source ?? 'APP', v.image_ref ?? null]);
      return cur ? `${cur.number} · ${cur.expires_on}` : null;
    }
    const col = field === 'expires_on' ? 'expires_on' : field === 'number' ? 'number' : null;
    if (!col) throw new Error(`Unknown field ${field}`);
    await write(ctx, 'PATCH', `/customers/${customerId}/identity-documents/${type}`, `UPDATE core.identity_documents SET ${col}=$3, verified_on=$4 WHERE customer_id=$1 AND type=$2 AND current`, [customerId, type, newValue, at], note);
    return cur?.[col] ?? null;
  }
  if (target === 'employment') {
    const cur = (await ctx.c.query(`SELECT * FROM core.employment WHERE customer_id=$1`, [customerId])).rows[0];
    const cols: Record<string, string> = { employer_id: 'employer_id', salary_total: 'salary_total', salary_basic: 'salary_basic', salary_certificate_on: 'salary_certificate_on', salary_bank: 'salary_bank', job_title: 'job_title' };
    const col = cols[field]; if (!col) throw new Error(`Unknown field ${field}`);
    await write(ctx, 'PATCH', `/customers/${customerId}/employment`, `UPDATE core.employment SET ${col}=$2 WHERE customer_id=$1`, [customerId, newValue], note);
    return cur?.[col] === null || cur?.[col] === undefined ? null : String(cur[col]);
  }
  if (target === 'salary_credits') {
    // field = month; newValue = explained reason
    const cur = (await ctx.c.query(`SELECT explained_reason FROM core.salary_credits WHERE customer_id=$1 AND month=$2`, [customerId, field])).rows[0];
    if (cur) await write(ctx, 'PATCH', `/customers/${customerId}/salary-credits/${field}`, `UPDATE core.salary_credits SET explained_reason=$3 WHERE customer_id=$1 AND month=$2`, [customerId, field, newValue], note);
    else await write(ctx, 'POST', `/customers/${customerId}/salary-credits`, `INSERT INTO core.salary_credits (customer_id, month, amount, source_tag, credited_on, explained_reason) VALUES ($1,$2,0,'GAP',$3,$4)`, [customerId, field, at, newValue], note);
    return cur?.explained_reason ?? null;
  }
  if (target === 'standing_orders') {
    // field = standing order id; newValue = classification
    const cur = (await ctx.c.query(`SELECT customer_classification, beneficiary_type FROM core.standing_orders WHERE id=$1 AND customer_id=$2`, [Number(field), customerId])).rows[0];
    await write(ctx, 'PATCH', `/customers/${customerId}/standing-orders/${field}`, `UPDATE core.standing_orders SET customer_classification=$3, classified_on=$4 WHERE id=$1 AND customer_id=$2`, [Number(field), customerId, newValue, at], note);
    return cur?.customer_classification ?? cur?.beneficiary_type ?? null;
  }
  if (target === 'customers') {
    const cur = (await ctx.c.query(`SELECT status, card_restricted, segment FROM core.customers WHERE id=$1`, [customerId])).rows[0];
    if (field === 'status') { await write(ctx, 'PATCH', `/customers/${customerId}`, `UPDATE core.customers SET status=$2, status_since=$3 WHERE id=$1`, [customerId, newValue, at], note); return cur?.status ?? null; }
    if (field === 'card_restricted') { await write(ctx, 'PATCH', `/customers/${customerId}`, `UPDATE core.customers SET card_restricted=$2 WHERE id=$1`, [customerId, newValue === 'true'], note); return String(cur?.card_restricted); }
    throw new Error(`Unknown field ${field}`);
  }
  if (target === 'accounts') {
    const had = (await ctx.c.query(`SELECT id FROM core.accounts WHERE customer_id=$1 AND type='CURRENT'`, [customerId])).rows[0];
    if (had) await write(ctx, 'PATCH', `/customers/${customerId}/accounts/${had.id}`, `UPDATE core.accounts SET status='ACTIVE', last_txn_on=$2 WHERE id=$1`, [had.id, at], note);
    else await write(ctx, 'POST', `/customers/${customerId}/accounts`, `INSERT INTO core.accounts (customer_id, type, iban, opened_on, status, last_txn_on, balance) VALUES ($1,'CURRENT',$2,$3,'ACTIVE',$3,0)`, [customerId, `QA00DEMO${customerId.replace(/\D/g, '').padStart(18, '0')}`, at], note);
    return had ? 'DORMANT' : null;
  }
  if (target === 'cautionary_notes') {
    const cur = (await ctx.c.query(`SELECT id, type FROM core.cautionary_notes WHERE customer_id=$1 AND lifted_on IS NULL AND type=$2`, [customerId, field])).rows[0];
    await write(ctx, 'PATCH', `/customers/${customerId}/cautionary-notes/${field}`, `UPDATE core.cautionary_notes SET lifted_on=$3, lifted_by=$4 WHERE customer_id=$1 AND type=$2 AND lifted_on IS NULL`, [customerId, field, at, newValue], note);
    return cur ? 'ACTIVE' : null;
  }
  if (target === 'consents') {
    const cur = (await ctx.c.query(`SELECT * FROM core.consents WHERE customer_id=$1`, [customerId])).rows[0];
    if (field === 'marketing_consent') { await write(ctx, 'PATCH', `/customers/${customerId}/consents`, `UPDATE core.consents SET marketing_consent=$2 WHERE customer_id=$1`, [customerId, newValue === 'true'], note); return String(cur?.marketing_consent); }
    if (field === 'channel_optouts') { await write(ctx, 'PATCH', `/customers/${customerId}/consents`, `UPDATE core.consents SET channel_optouts=$2 WHERE customer_id=$1`, [customerId, (newValue ?? '').split(',').filter(Boolean)], note); return (cur?.channel_optouts ?? []).join(','); }
    if (field === 'dnc') { await write(ctx, 'PATCH', `/customers/${customerId}/consents`, `UPDATE core.consents SET dnc=$2, dnc_since=$3, dnc_reason=$4 WHERE customer_id=$1`, [customerId, newValue !== 'false', at, note ?? null], note); return String(cur?.dnc); }
    throw new Error(`Unknown field ${field}`);
  }
  if (target === 'employers') {
    const cur = (await ctx.c.query(`SELECT approval_status FROM core.employers WHERE id=$1`, [field])).rows[0];
    await write(ctx, 'PATCH', `/employers/${field}`, `UPDATE core.employers SET approval_status=$2, approved_on=$3 WHERE id=$1`, [field, newValue, newValue === 'APPROVED' ? at : null], note);
    return cur?.approval_status ?? null;
  }
  throw new Error(`Unknown target ${target}`);
}

/** Simulated bank events the demo needs: a payment clears DPD; a device delivery. */
export async function recordPayment(ctx: Ctx, customerId: string) {
  const at = now().toISOString().slice(0, 10);
  await write(ctx, 'POST', `/customers/${customerId}/payments`, `UPDATE core.finance_facilities SET dpd=0, dpd_since=NULL, last_paid_on=$2 WHERE customer_id=$1 AND dpd>0`, [customerId, at], 'Instalment paid');
  await write(ctx, 'POST', `/customers/${customerId}/payments`, `UPDATE core.cards SET dpd=0, dpd_since=NULL WHERE customer_id=$1 AND dpd>0`, [customerId], 'Card minimum paid');
}

/**
 * The bank's own monthly events, so the core data moves with the clock:
 * on the 25th, salaries are credited for customers whose salary arrived the
 * month before (a stopped salary stays stopped), and DPD counters age daily.
 */
export async function payrollRun(c: Q, day: string) {
  if (!day.endsWith('-25')) return 0;
  const month = day.slice(0, 7);
  const prev = new Date(day + 'T00:00:00Z'); prev.setUTCMonth(prev.getUTCMonth() - 1); const prevMonth = prev.toISOString().slice(0, 7);
  const r = await c.query(
    `INSERT INTO core.salary_credits (customer_id, month, amount, source_tag, credited_on, employer_ref)
       SELECT p.customer_id, $1, p.amount, 'SALARY', $2::date, p.employer_ref FROM core.salary_credits p
        WHERE p.month=$3 AND p.amount > 0 AND p.source_tag='SALARY'
          AND NOT EXISTS (SELECT 1 FROM core.salary_credits x WHERE x.customer_id=p.customer_id AND x.month=$1)
          AND EXISTS (SELECT 1 FROM core.customers cu WHERE cu.id=p.customer_id AND cu.status NOT IN ('CLOSED','DECEASED'))`,
    [month, day, prevMonth]);
  if (r.rowCount) await c.query(`INSERT INTO layer.integration_log (at, system, direction, verb, resource, status, note, actor) VALUES ($1,'CORE','IN','EVENT','/salary-credits',200,$2,'core')`, [now(), `Payroll run ${month}: ${r.rowCount} salary credit(s)`]);
  return r.rowCount ?? 0;
}
export async function ageDpd(c: Q, day: string) {
  await c.query(`UPDATE core.finance_facilities SET dpd = GREATEST(1, ($1::date - dpd_since)) WHERE dpd_since IS NOT NULL AND dpd > 0`, [day]);
  await c.query(`UPDATE core.cards SET dpd = GREATEST(1, ($1::date - dpd_since)) WHERE dpd_since IS NOT NULL AND dpd > 0`, [day]);
}
