/**
 * Outbound messages: scheduling inside the policy window, Hami's check at
 * send time, delivery through a channel adapter (simulated: writes to the
 * customer's phone or mailbox in core.device_inbox), and the record of it all
 * in layer.outreach_messages. Nothing leaves without `guard`.
 */
import type { PoolClient } from 'pg';
import { guard, nextAllowed, render, templateFor, type Channel, type MessageType, type Policy, type Segment, fmtDate, qar, SEGMENT_LABEL, REASON, addMonths } from '@jahiz/domain';
import { now, today } from '../clock.js';
import { addTrail, addActivity, type CaseRow } from '../engine/core.js';
import { external, type FullFacts, type Ctx } from '../core/connector.js';
import { deliver } from './adapters.js';

export type Q = { query: PoolClient['query'] };

const AUTOMATED: Channel[] = ['PUSH', 'INAPP', 'EMAIL', 'SMS', 'WHATSAPP'];

/** The automated channels this customer can be reached on, in the segment's order. */
export function usableChannels(f: FullFacts, policy: Policy): Channel[] {
  const order = policy.list('channelOrder', f.segment) as Channel[];
  const enabled = policy.list('channelEnabled');
  return order.filter((ch) => AUTOMATED.includes(ch) && enabled.includes(ch) && !f.consent.channel_optouts.includes(ch)
    && ((ch !== 'PUSH' && ch !== 'INAPP') || (f.contact?.app_registered && (ch !== 'PUSH' || f.contact.push_enabled)))
    && (ch !== 'EMAIL' || !!f.contact?.email) && (ch !== 'SMS' || !!f.contact?.mobile));
}

export function vars(f: FullFacts, kase: CaseRow | null, policy: Policy, extra: Record<string, any> = {}) {
  const lang = f.lang;
  return {
    name: lang === 'ar' ? f.nameAr : f.nameEn, ref: kase?.ref ?? '—', sender: policy.str('senderIdentity'), segment: SEGMENT_LABEL[f.segment], rim: f.rimNo,
    expiry: fmtDate(extra.expiry ?? (kase?.primary_reason === 'R06' ? f.passportExpiry : f.qidExpiry)), reasonLabel: kase?.primary_reason ? REASON[kase.primary_reason as keyof typeof REASON].label : '',
    ...extra,
  };
}

export type ScheduleIn = {
  kase: CaseRow | null; f: FullFacts; policy: Policy; channel: Channel; type: MessageType; reason?: string | null; attempt?: number; notBefore?: Date; vars?: Record<string, any>;
  createdBy: string; runId?: number | null; approvedBy?: string | null; meta?: Record<string, any>; marketing?: boolean;
};

/** Schedule one message at the first allowed instant at or after `notBefore`. */
export async function scheduleMessage(c: Q, s: ScheduleIn) {
  const t = templateFor((s.reason ?? s.kase?.primary_reason ?? null) as any, s.type, s.f.lang);
  const r = render(t, vars(s.f, s.kase, s.policy, s.vars), s.channel);
  const at = nextAllowed(s.notBefore ?? now(), s.f.segment, s.channel, s.policy);
  const row = (await c.query(
    `INSERT INTO layer.outreach_messages (case_id, run_id, customer_id, channel, template_key, message_type, marketing, lang, attempt, scheduled_for, window_used, status, policy_version, subject, body, approved_by, created_by, created_at, meta)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'SCHEDULED',$12,$13,$14,$15,$16,$17,$18) RETURNING *`,
    [s.kase?.id ?? null, s.runId ?? null, s.f.id, s.channel, t.key, s.type, s.marketing ?? t.marketing, s.f.lang, s.attempt ?? 1, at, `${s.policy.str(s.channel === 'CALL' ? 'callWindowStart' : 'serviceWindowStart', s.f.segment)}–${s.policy.str(s.channel === 'CALL' ? 'callWindowEnd' : 'serviceWindowEnd', s.f.segment)}`, s.policy.version, r.subject, r.body, s.approvedBy ?? null, s.createdBy, now(), JSON.stringify(s.meta ?? {})],
  )).rows[0];
  return row;
}

/** Everything sent to this customer in the last 30 days (for the caps). */
async function recentSends(c: Q, customerId: string, at: Date): Promise<Date[]> {
  return (await c.query(`SELECT sent_at FROM layer.outreach_messages WHERE customer_id=$1 AND status IN ('SENT','DELIVERED') AND sent_at > $2`, [customerId, new Date(at.getTime() - 31 * 86_400_000)])).rows.map((r: any) => new Date(r.sent_at));
}

export type DispatchResult = { id: number; status: 'SENT' | 'BLOCKED'; reason?: string; clause?: string; channel: Channel; fallback?: number };

/** Hami's check, then delivery. `rmApproved` is read from the row (approved_by). */
export async function dispatch(c: Q, messageId: number, f: FullFacts, policy: Policy, scenario?: string | null): Promise<DispatchResult> {
  const m = (await c.query(`SELECT * FROM layer.outreach_messages WHERE id=$1`, [messageId])).rows[0];
  if (!m || m.status !== 'SCHEDULED') return { id: messageId, status: m?.status ?? 'BLOCKED', channel: m?.channel };
  const kase = m.case_id ? (await c.query(`SELECT * FROM layer.cases WHERE id=$1`, [m.case_id])).rows[0] as CaseRow : null;
  const at = now();
  const sent = await recentSends(c, f.id, at);
  const listed = f.returnedCheques.some((ch) => !ch.settledOn || addMonths(ch.settledOn, policy.num('returnedChequeLookbackMonths')) > today());
  const v = guard({
    channel: m.channel, marketing: m.marketing, regulatoryLetter: !!m.meta?.regulatory, segment: f.segment, at,
    consents: { marketing: f.consent.marketing_consent, channelOptouts: f.consent.channel_optouts, dnc: f.consent.dnc },
    status: f.status, paused: !!kase?.paused, anyDpd: f.facilities.some((x) => x.dpd > 0) || f.cards.some((x) => x.dpd > 0), activeNote: f.notes.some((n) => !n.lifted), returnedChequeListed: listed,
    rmApproved: !!m.approved_by, sentAt: sent,
  }, policy);
  const ctx: Ctx = { c, actor: 'hami', runId: m.run_id };
  if (!v.allow && /cap/.test(v.reason) && (m.meta?.deferred ?? 0) < 5) {
    // A contact-cap breach defers the message to the next allowed slot a day later; it is not refused.
    const when = nextAllowed(new Date(at.getTime() + 24 * 3600_000), f.segment, m.channel, policy);
    await c.query(`UPDATE layer.outreach_messages SET scheduled_for=$2, meta = meta || $3::jsonb WHERE id=$1`, [m.id, when, JSON.stringify({ deferred: (m.meta?.deferred ?? 0) + 1, deferredWhy: v.reason })]);
    await addTrail(c, { actor_type: 'AGENT', actor_id: 'hami', actor_name: 'Hami', autonomy: 'A3', act: 'DEFER', clause: v.clause, policy_version: policy.version, channel: m.channel, case_id: kase?.id, case_ref: kase?.ref, customer_id: f.id, run_id: m.run_id, scenario_key: scenario,
      summary: `Deferred the ${m.channel} ${m.message_type.toLowerCase().replace('_', ' ')} to ${when.toISOString().slice(0, 10)}: ${v.reason} [${v.clause}]`, summary_ar: `أُجّلت الرسالة: ${v.reason}` });
    return { id: m.id, status: 'BLOCKED', reason: v.reason, clause: v.clause, channel: m.channel };
  }
  if (!v.allow) {
    await c.query(`UPDATE layer.outreach_messages SET status='BLOCKED', block_reason=$2, block_clause=$3, policy_version=$4 WHERE id=$1`, [m.id, v.reason, v.clause, policy.version]);
    await addTrail(c, { actor_type: 'AGENT', actor_id: 'hami', actor_name: 'Hami', autonomy: 'A3', act: 'BLOCK', clause: v.clause, policy_version: policy.version, channel: m.channel, case_id: kase?.id, case_ref: kase?.ref, customer_id: f.id, run_id: m.run_id, scenario_key: scenario,
      summary: `Blocked the ${m.channel} ${m.message_type.toLowerCase().replace('_', ' ')}: ${v.reason} [${v.clause}]`, summary_ar: `حجب رسالة ${m.channel}: ${v.reason} [${v.clause}]`, evidence_ref: `message:${m.id}` });
    await addActivity(c, { trigger: 'Due message', agent: 'hami', action: `Checked ${m.channel} ${m.message_type} for ${f.id}`, result: `Blocked: ${v.reason}`, autonomy: 'A3', clause: v.clause, case_ref: kase?.ref, customer_id: f.id, scenario_key: scenario });
    await external(ctx, 'CHANNEL', 'POST', `/${m.channel.toLowerCase()}/send`, `Not sent: ${v.reason}`, 403);
    // A channel-specific block moves the message to the next permitted channel; a customer- or policy-level block does not.
    const channelLevel = /opted out of|not an allowed channel|not enabled|Outside the|quiet window|Public holiday/.test(v.reason) && !/no automated message/.test(v.reason);
    if (channelLevel && !m.meta?.fallbackOf) {
      const usable = usableChannels(f, policy).filter((ch) => ch !== m.channel);
      if (usable.length) {
        const next = usable[0];
        const t = templateFor(m.template_key.split(':')[0].startsWith('R') ? m.template_key.split(':')[0] as any : null, m.message_type, m.lang);
        const r = render(t, vars(f, kase, policy, m.meta?.vars ?? {}), next);
        const when = nextAllowed(at, f.segment, next, policy);
        const fb = (await c.query(`INSERT INTO layer.outreach_messages (case_id, run_id, customer_id, channel, template_key, message_type, marketing, lang, attempt, scheduled_for, window_used, status, policy_version, subject, body, approved_by, created_by, created_at, meta)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'SCHEDULED',$12,$13,$14,$15,'hami',$16,$17) RETURNING id`,
          [m.case_id, m.run_id, m.customer_id, next, m.template_key, m.message_type, m.marketing, m.lang, m.attempt, when, m.window_used, policy.version, r.subject, r.body, m.approved_by, at, JSON.stringify({ ...(m.meta ?? {}), fallbackOf: m.id })])).rows[0];
        return { id: m.id, status: 'BLOCKED', reason: v.reason, clause: v.clause, channel: m.channel, fallback: fb.id };
      }
    }
    return { id: m.id, status: 'BLOCKED', reason: v.reason, clause: v.clause, channel: m.channel };
  }
  await deliver(c, { customerId: f.id, channel: m.channel, subject: m.subject, body: m.body, lang: m.lang, ref: kase?.ref ?? null, messageId: m.id, meta: { type: m.message_type, marketing: m.marketing, amount: m.meta?.vars?.amount } });
  await c.query(`UPDATE layer.outreach_messages SET status='SENT', sent_at=$2, policy_version=$3 WHERE id=$1`, [m.id, at, policy.version]);
  await external(ctx, 'CHANNEL', 'POST', `/${m.channel.toLowerCase()}/send`, `${m.message_type} → ${f.id} (${m.lang})`);
  if (kase && m.attempt && !m.marketing && ['REQUEST', 'REMINDER', 'FINAL_NOTICE', 'PRE_EXPIRY'].includes(m.message_type)) {
    await c.query(`UPDATE layer.cases SET attempts=GREATEST(attempts,$2), state=CASE WHEN state IN ('QUEUED','CONTACTED','AWAITING_REPLY','REMINDING') THEN 'AWAITING_REPLY' ELSE state END, next_action_at=$3, updated_at=$4 WHERE id=$1`,
      [kase.id, m.attempt, new Date(at.getTime() + policy.num('reminderIntervalDays', f.segment) * 86_400_000), at]);
  }
  await addTrail(c, { actor_type: 'AGENT', actor_id: 'munadi', actor_name: 'Munadi', autonomy: f.segment === 'HNWI' ? 'A2' : f.segment === 'VVIP' ? 'A1' : 'A3', act: 'SEND', policy_version: policy.version, channel: m.channel, clause: 'POL-01 §3.2', case_id: kase?.id, case_ref: kase?.ref, customer_id: f.id, run_id: m.run_id, scenario_key: scenario,
    summary: `Sent the ${m.message_type.toLowerCase().replace('_', ' ')} by ${m.channel} (${m.lang.toUpperCase()}, attempt ${m.attempt})${m.approved_by ? `, approved by ${m.approved_by}` : ''}`, summary_ar: `أرسل ${m.message_type} عبر ${m.channel}`, evidence_ref: `message:${m.id}` });
  await addActivity(c, { trigger: 'Due message', agent: 'munadi', action: `Sent ${m.message_type} by ${m.channel} to ${f.id}`, result: `Allowed by Hami (policy v${policy.version})`, autonomy: 'A3', case_ref: kase?.ref, customer_id: f.id, scenario_key: scenario });
  return { id: m.id, status: 'SENT', channel: m.channel };
}

/** Cancel the remaining scheduled messages of a case (a reply arrived, or the case closed). */
export async function cancelScheduled(c: Q, caseId: number, reason: string, onlyMarketing = false) {
  const r = await c.query(`UPDATE layer.outreach_messages SET status='CANCELLED', block_reason=$2 WHERE case_id=$1 AND status='SCHEDULED' ${onlyMarketing ? 'AND marketing' : ''} RETURNING id`, [caseId, reason]);
  return r.rowCount ?? 0;
}
export { qar };
