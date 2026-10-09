/**
 * The API behind "QIB Mobile (demo)", the Expo Go mock-up in apps/mobile.
 * Same records and the same inbound pipeline as the Customer app screen in
 * the web shell; cross-origin because the phone talks to the Replit domain.
 * Nothing here is authenticated: it is a demo, and every id starts with DEMO-.
 */
import { Router } from 'express';
import { pool, tx } from '../db.js';
import { now, today } from '../clock.js';
import { factsOf } from '../core/connector.js';
import { receive } from '../inbound.js';
import { SPECIMEN_KINDS } from '../agents/specimens.js';
import { addActivity, addTrail } from '../engine/core.js';
import { invalidateHealth } from '../health.js';
import { EDGES } from '../seed/edge.js';
const EDGE_LABELS: Record<string, string> = Object.fromEntries(EDGES.map((e) => [e.key, e.title]));

export const mobile = Router();

mobile.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'content-type');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

const bad = (res: any, e: any) => res.status(400).json({ error: e?.message ?? String(e) });

/** What the app asks the customer to do for the primary reason of the open case. */
const ASK: Record<string, { en: string; ar: string; doc?: string }> = {
  R07: { en: 'Upload your renewed Qatar ID (front and back)', ar: 'حمّل بطاقتك الشخصية القطرية المجددة (الوجه والظهر)', doc: 'QID' },
  R06: { en: 'Upload the data page of your renewed passport', ar: 'حمّل صفحة البيانات من جواز سفرك المجدد', doc: 'PASSPORT' },
  R01: { en: 'Upload a recent salary certificate or an HR letter', ar: 'حمّل شهادة راتب حديثة أو رسالة من الموارد البشرية', doc: 'SALARY_CERTIFICATE' },
  R02: { en: 'Upload a salary certificate naming your employer', ar: 'حمّل شهادة راتب تذكر اسم جهة عملك', doc: 'SALARY_CERTIFICATE' },
  R04: { en: 'Tell us what each standing order is for', ar: 'أخبرنا بالغرض من كل أمر دفع مستديم' },
  R08: { en: 'Open a current account', ar: 'افتح حساباً جارياً' },
  R13: { en: 'Confirm your details to reactivate your account', ar: 'أكّد بياناتك لإعادة تفعيل حسابك' },
};

/** Customers the demo can sign in as: the named edge cases first, then a few ordinary app users. */
mobile.get('/customers', async (_req, res) => {
  try {
    const edge: Record<string, string> = (await pool.query(`SELECT value FROM layer.meta WHERE key='edge_cases'`)).rows[0]?.value ?? {};
    const ids = Object.values(edge);
    const rows = (await pool.query(
      `SELECT c.id, c.name_en, c.name_ar, c.segment, c.language_pref, ct.app_registered FROM core.customers c JOIN core.contacts ct ON ct.customer_id=c.id
        WHERE c.id = ANY($1) OR (ct.app_registered AND c.id IN (SELECT id FROM core.customers WHERE id NOT IN (SELECT unnest($1::text[])) ORDER BY id LIMIT 6)) ORDER BY c.id`, [ids])).rows;
    const byId = Object.fromEntries(Object.entries(edge).map(([k, v]) => [v, k]));
    res.json(rows.map((r: any) => ({ id: r.id, nameEn: r.name_en, nameAr: r.name_ar, segment: r.segment, lang: r.language_pref, edge: byId[r.id] ?? null, title: byId[r.id] ? EDGE_LABELS[byId[r.id]] ?? null : null })));
  } catch (e) { bad(res, e); }
});

mobile.get('/specimens', (_req, res) => res.json(SPECIMEN_KINDS));

/** Everything the app shows for one customer. */
mobile.get('/:id/home', async (req, res) => {
  try {
    const id = req.params.id;
    const f = await factsOf({ c: pool, actor: 'customer-app' }, id);
    const accounts = (await pool.query(`SELECT id, type, iban, status, balance, last_txn_on FROM core.accounts WHERE customer_id=$1 ORDER BY id`, [id])).rows;
    const cards = (await pool.query(`SELECT id, card_limit, outstanding, min_due, dpd, status FROM core.cards WHERE customer_id=$1 ORDER BY id`, [id])).rows;
    const facilities = (await pool.query(`SELECT id, product, principal, outstanding, instalment, maturity, dpd FROM core.finance_facilities WHERE customer_id=$1 ORDER BY id`, [id])).rows;
    const docs = (await pool.query(`SELECT type, number, expires_on, issued_on, current FROM core.identity_documents WHERE customer_id=$1 AND current ORDER BY type`, [id])).rows;
    const inbox = (await pool.query(`SELECT id, channel, kind, at, subject, body, lang, ref, read_at, meta FROM core.device_inbox WHERE customer_id=$1 ORDER BY at DESC, id DESC LIMIT 60`, [id])).rows;
    const kase = (await pool.query(`SELECT ref, state, cls, primary_reason, reasons, paused, opened_at FROM layer.cases WHERE customer_id=$1 AND state<>'CLOSED' ORDER BY id DESC LIMIT 1`, [id])).rows[0] ?? null;
    const uploads = (await pool.query(`SELECT id, type, state, received_at, recommendation, overall_confidence FROM layer.documents WHERE customer_id=$1 ORDER BY id DESC LIMIT 10`, [id])).rows;
    const latest = (await pool.query(`SELECT eligible, amount, reason_codes, run_id FROM core.preapproval_results WHERE customer_id=$1 ORDER BY run_id DESC LIMIT 1`, [id])).rows[0] ?? null;
    const accepted = inbox.some((m: any) => m.meta?.accepted);
    const offerMsg = inbox.find((m: any) => m.meta?.type === 'OFFER' && m.kind !== 'OUTGOING') ?? null;
    const sos = (await pool.query(`SELECT id, beneficiary_type, beneficiary_name, amount FROM core.standing_orders WHERE customer_id=$1 ORDER BY id`, [id])).rows;
    const ask = kase && !kase.paused && ASK[kase.primary_reason] ? { ...ASK[kase.primary_reason], reason: kase.primary_reason, ref: kase.ref } : null;
    const deposits = accounts.filter((a: any) => a.type !== 'CURRENT').reduce((s: number, a: any) => s + Number(a.balance), 0);
    res.json({
      now: now().toISOString(), today: today(),
      customer: { id: f.id, nameEn: f.nameEn, nameAr: f.nameAr, lang: f.lang, segment: f.segment, tier: f.segment === 'VVIP' ? 'Private Banking' : f.segment === 'HNWI' ? 'Tamayuz' : 'Essential', isQatari: f.isQatari, nationality: f.nationality, mobile: f.contact?.mobile, email: f.contact?.email, rimNo: f.rimNo, employer: f.employerName, salaryTotal: f.salaryTotal, marketing: f.consent.marketing_consent, optouts: f.consent.channel_optouts, status: f.status },
      accounts, cards, facilities, standingOrders: sos, deposits,
      documents: docs.map((d: any) => ({ type: d.type, number: d.number, expiresOn: d.expires_on, issuedOn: d.issued_on, expired: d.expires_on < today(), expiringSoon: !(d.expires_on < today()) && d.expires_on <= addDays(today(), 90) })),
      inbox, case: kase, ask, uploads,
      offer: latest?.eligible && !accepted ? { amount: Number(latest.amount), tenor: 48, since: offerMsg?.at ?? null, ref: offerMsg?.ref ?? null } : null,
      accepted, eligibility: latest,
    });
  } catch (e) { bad(res, e); }
});

const addDays = (d: string, n: number) => { const x = new Date(d + 'T00:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };

mobile.post('/:id/upload', async (req, res) => {
  try {
    const specimen = req.body.specimen as string | undefined; const image = req.body.image as { data: string; mime: string; name?: string; type?: string } | undefined;
    if (!specimen && !image) throw new Error('Pick a specimen or attach an image');
    const r = await tx((c) => receive(c, { channel: 'INAPP', customerId: req.params.id, body: req.body.text ?? 'Uploaded from QIB Mobile (demo, Expo Go)', attachments: [specimen ? { specimen: specimen as any } : { image: image! }], assurance: 'APP_UPLOAD' }));
    await pool.query(`UPDATE layer.triggers SET last_fired_at=$1, fired_count=fired_count+1, last_result=$2 WHERE key='inbound_app'`, [now(), `Upload from ${req.params.id} (Expo Go)`]);
    invalidateHealth();
    res.json({ ok: true, ...r });
  } catch (e) { bad(res, e); }
});

mobile.post('/:id/reply', async (req, res) => {
  try {
    const r = await tx((c) => receive(c, { channel: 'INAPP', customerId: req.params.id, body: String(req.body.text ?? '') }));
    await pool.query(`UPDATE layer.triggers SET last_fired_at=$1, fired_count=fired_count+1, last_result=$2 WHERE key='inbound_app'`, [now(), `Reply from ${req.params.id} (Expo Go)`]);
    res.json({ ok: true, ...r });
  } catch (e) { bad(res, e); }
});

/** The One Click acceptance: amount and tenor chosen in the app, OTP "confirmed" there; the disbursement is simulated. */
mobile.post('/:id/accept-offer', async (req, res) => {
  try {
    const amount = Number(req.body.amount ?? 0), tenor = Number(req.body.tenor ?? 48);
    await tx(async (c) => {
      const f = await factsOf({ c, actor: 'customer-app' }, req.params.id);
      await c.query(`INSERT INTO core.device_inbox (customer_id, channel, kind, at, subject, body, lang, meta) VALUES ($1,'INAPP','OUTGOING',$2,'One Click Finance',$3,$4,$5)`,
        [f.id, now(), `Offer accepted in the app: QAR ${amount.toLocaleString('en-US')} over ${tenor} months`, f.lang, JSON.stringify({ accepted: true, amount, tenor })]);
      await c.query(`INSERT INTO layer.integration_log (at, system, direction, verb, resource, status, note, actor) VALUES ($1,'ONECLICK','IN','POST','/acceptances',200,$2,'customer-app')`, [now(), `${f.id} accepted QAR ${amount} over ${tenor} months (simulated disbursement)`]);
      await addTrail(c, { actor_type: 'SYSTEM', actor_id: 'oneclick', actor_name: 'One Click Finance', autonomy: null, act: 'ACCEPT', customer_id: f.id, after: { amount, tenor }, summary: `${f.id} accepted the One Click offer in the app: QAR ${amount.toLocaleString('en-US')} over ${tenor} months (simulated)`, summary_ar: 'قبل العميل العرض في التطبيق' });
      await addActivity(c, { trigger: 'Customer app', agent: null, action: `${f.id} accepted the One Click offer (QAR ${amount.toLocaleString('en-US')}, ${tenor} months)`, result: 'Simulated disbursement logged', customer_id: f.id });
    });
    res.json({ ok: true, reference: `OCF-${Date.now().toString().slice(-8)}` });
  } catch (e) { bad(res, e); }
});

mobile.post('/:id/read', async (req, res) => {
  try { await pool.query(`UPDATE core.device_inbox SET read_at=$2 WHERE customer_id=$1 AND read_at IS NULL`, [req.params.id, now()]); res.json({ ok: true }); } catch (e) { bad(res, e); }
});
