/**
 * Channel adapters. v1 ships SIMULATED implementations that deliver into the
 * customer's phone (QIB Mobile demo) or mailbox (core.device_inbox), which the
 * Customer app and Mailbox screens render. The Microsoft Graph adapter for
 * e-mail is specified and stubbed (graph.ts) — one swap when QIB wants a real
 * round trip through a shared mailbox.
 */
import type { PoolClient } from 'pg';
import type { Channel } from '@jahiz/domain';
import { now } from '../clock.js';
import { graphConfigured, graphSend } from './graph.js';

type Q = { query: PoolClient['query'] };
export type Delivery = { customerId: string; channel: Channel; subject: string; body: string; lang: string; ref: string | null; messageId: number | null; meta?: Record<string, any> };

export async function deliver(c: Q, d: Delivery) {
  switch (d.channel) {
    case 'PUSH': case 'INAPP': case 'SMS': case 'WHATSAPP': case 'LETTER':
      await c.query(`INSERT INTO core.device_inbox (customer_id, channel, kind, at, subject, body, lang, ref, message_id, meta) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [d.customerId, d.channel, d.channel, now(), d.subject, d.body, d.lang, d.ref, d.messageId, JSON.stringify(d.meta ?? {})]);
      return;
    case 'EMAIL':
      if (graphConfigured()) { await graphSend(d); }
      await c.query(`INSERT INTO core.device_inbox (customer_id, channel, kind, at, subject, body, lang, ref, message_id, meta) VALUES ($1,'EMAIL','EMAIL',$2,$3,$4,$5,$6,$7,$8)`,
        [d.customerId, now(), d.subject, d.body, d.lang, d.ref, d.messageId, JSON.stringify({ ...(d.meta ?? {}), via: graphConfigured() ? 'graph' : 'simulated' })]);
      return;
    case 'CALL': case 'RM':
      // A call or an RM contact is a task for a person, created by the caller; nothing reaches the device.
      return;
  }
}
