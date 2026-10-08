/**
 * The inbound pipeline: everything a customer sends (app upload, app reply,
 * e-mail through the mailbox simulator or, in production, the Graph poller)
 * enters here, becomes an inbound message with its documents, and runs WF-06.
 */
import type { PoolClient } from 'pg';
import { now } from './clock.js';
import { factsOf, type Ctx } from './core/connector.js';
import { startRun, addActivity } from './engine/core.js';
import { matchEmail } from './agents/mustaqbil.js';
import { buildSpecimen, specimenDef, type SpecimenKind } from './agents/specimens.js';
import { today } from './clock.js';

export type Attachment = { specimen?: SpecimenKind; image?: { data: string; mime: string; name?: string; type?: string }; otherCustomerId?: string };
export type ReceiveIn = { channel: 'INAPP' | 'EMAIL'; customerId?: string | null; from?: string; subject?: string; body: string; attachments?: Attachment[]; assurance?: 'APP_LIVENESS' | 'APP_UPLOAD' | 'RM_SCAN' | 'EMAIL'; scenario?: string | null };

export async function receive(c: PoolClient, i: ReceiveIn) {
  const at = now();
  let customerId = i.customerId ?? null; let caseId: number | null = null;
  if (!customerId && i.channel === 'EMAIL') { const m = await matchEmail(c, i.from ?? '', i.subject ?? '', i.body); customerId = m.customerId; caseId = m.caseId; }
  if (customerId && !caseId) caseId = (await c.query(`SELECT id FROM layer.cases WHERE customer_id=$1 AND state<>'CLOSED' ORDER BY id DESC LIMIT 1`, [customerId])).rows[0]?.id ?? null;
  const inb = (await c.query(`INSERT INTO layer.inbound_messages (case_id, customer_id, channel, received_at, from_addr, subject, body, attachments, state) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'NEW') RETURNING id`,
    [caseId, customerId, i.channel, at, i.from ?? null, i.subject ?? null, i.body, JSON.stringify((i.attachments ?? []).map((a) => ({ specimen: a.specimen ?? null, name: a.image?.name ?? a.specimen ?? 'attachment', type: a.image?.type ?? null })))])).rows[0];
  const documentIds: number[] = [];
  if (customerId) {
    const ctx: Ctx = { c, actor: 'mustaqbil' };
    const f = await factsOf(ctx, customerId);
    const assurance = i.assurance ?? (i.channel === 'EMAIL' ? 'EMAIL' : 'APP_UPLOAD');
    for (const a of i.attachments ?? []) {
      if (a.specimen) {
        const def = specimenDef(a.specimen); if (!def) continue;
        const other = a.specimen === 'qid-other-person' ? await factsOf(ctx, a.otherCustomerId ?? (await c.query(`SELECT id FROM core.customers WHERE id<>$1 AND is_qatari=$2 ORDER BY id LIMIT 1`, [customerId, f.isQatari])).rows[0].id) : undefined;
        const spec = buildSpecimen(a.specimen, f, today(), other);
        const d = (await c.query(`INSERT INTO layer.documents (inbound_id, case_id, customer_id, type, image_ref, specimen_key, received_at, source, assurance, state) VALUES ($1,$2,$3,$4,'',$5,$6,$7,$8,'RECEIVED') RETURNING id`,
          [inb.id, caseId, customerId, spec.type, a.specimen, at, JSON.stringify({ specimen: spec }), assurance])).rows[0];
        await c.query(`UPDATE layer.documents SET image_ref=$2 WHERE id=$1`, [d.id, `/api/documents/${d.id}/image.svg`]);
        documentIds.push(d.id);
      } else if (a.image) {
        const type = a.image.type ?? 'QID';
        const d = (await c.query(`INSERT INTO layer.documents (inbound_id, case_id, customer_id, type, image_ref, received_at, source, assurance, state) VALUES ($1,$2,$3,$4,'',$5,$6,$7,'RECEIVED') RETURNING id`,
          [inb.id, caseId, customerId, type, at, JSON.stringify({ image: { data: a.image.data, mime: a.image.mime, name: a.image.name ?? 'upload' } }), assurance])).rows[0];
        await c.query(`UPDATE layer.documents SET image_ref=$2 WHERE id=$1`, [d.id, `/api/documents/${d.id}/image`]);
        documentIds.push(d.id);
      }
    }
    // The customer's own device shows what they sent.
    await c.query(`INSERT INTO core.device_inbox (customer_id, channel, kind, at, subject, body, lang, ref, meta) VALUES ($1,$2,'OUTGOING',$3,$4,$5,$6,$7,$8)`,
      [customerId, i.channel, at, i.subject ?? null, i.body, f.lang, caseId ? (await c.query(`SELECT ref FROM layer.cases WHERE id=$1`, [caseId])).rows[0]?.ref : null, JSON.stringify({ attachments: (i.attachments ?? []).map((a) => a.specimen ?? a.image?.name ?? 'attachment'), documentIds })]);
  }
  await addActivity(c, { trigger: `Inbound ${i.channel}`, agent: null, action: `${i.channel === 'INAPP' ? 'App' : 'E-mail'} from ${customerId ?? i.from ?? 'unknown'}: ${(i.attachments ?? []).length} attachment(s)`, result: i.body.slice(0, 80), customer_id: customerId, scenario_key: i.scenario });
  const run = await startRun(c, { caseId, workflowId: 'WF-06', title: `Inbound ${i.channel} — ${customerId ?? i.from ?? 'unmatched'}`, title_ar: `وارد ${i.channel}`, channel: 'INBOUND', scenario: i.scenario ?? null, payload: { inboundId: inb.id, customerId, caseId, documentIds } });
  return { inboundId: inb.id as number, runId: run.id, documentIds, customerId, caseId };
}
