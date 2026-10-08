/**
 * Microsoft Graph adapter — the production implementation of the e-mail
 * channel (send through a shared mailbox, poll inbound, download attachments).
 *
 * STUBBED in v1 by decision (DESIGN §20): a demo that depends on a real
 * mailbox and OAuth consent breaks in the room and would leak synthetic
 * customer data into a real tenant. When the four variables below are set,
 * `graphConfigured()` turns true and `graphSend` would call
 * POST https://graph.microsoft.com/v1.0/users/{GRAPH_MAILBOX}/sendMail with a
 * client-credentials token. The polling side (GET /users/{mailbox}/messages
 * with $filter on receivedDateTime, then /attachments) would feed
 * POST /api/inbound/email exactly as the mailbox simulator does.
 *
 * Required: GRAPH_TENANT_ID, GRAPH_CLIENT_ID, GRAPH_CLIENT_SECRET, GRAPH_MAILBOX
 * (application permission Mail.Send and Mail.ReadWrite on the shared mailbox).
 */
import type { Delivery } from './adapters.js';

export const graphConfigured = () => Boolean(process.env.GRAPH_TENANT_ID && process.env.GRAPH_CLIENT_ID && process.env.GRAPH_CLIENT_SECRET && process.env.GRAPH_MAILBOX);

export async function graphSend(d: Delivery) {
  // Intentionally not wired live in v1. The shape of the call, for the record:
  // const token = await clientCredentials(tenant, clientId, secret, 'https://graph.microsoft.com/.default');
  // await fetch(`https://graph.microsoft.com/v1.0/users/${mailbox}/sendMail`, { method: 'POST', headers: { Authorization: `Bearer ${token}` },
  //   body: JSON.stringify({ message: { subject: d.subject, body: { contentType: 'Text', content: d.body }, toRecipients: [{ emailAddress: { address: customerEmail } }] }, saveToSentItems: true }) });
  console.warn(`[graph] configured but not wired in v1: would send "${d.subject}" to ${d.customerId}`);
}
export const graphStatus = () => ({ configured: graphConfigured(), wired: false, mailbox: process.env.GRAPH_MAILBOX ?? null, needs: ['GRAPH_TENANT_ID', 'GRAPH_CLIENT_ID', 'GRAPH_CLIENT_SECRET', 'GRAPH_MAILBOX'] });
