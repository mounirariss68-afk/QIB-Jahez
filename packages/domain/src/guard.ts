/**
 * Hami's check (DESIGN §5, POL-01/05/07/09): every outbound action passes
 * through `guard` before it leaves. Pure: the server gathers the inputs and
 * records the verdict. The three suppression lists are checked in order
 * (DNC, marketing opt-out, channel opt-out), then status and pause, then
 * conduct suppression for offers, then the segment channel rule and the RM
 * approval requirement, then the window and the caps.
 */
import { capBreach, quietAt } from './calendar.js';
import type { Policy } from './policy.js';
import type { Channel, CustomerStatus, Segment } from './types.js';

export type GuardInput = {
  channel: Channel; marketing: boolean; regulatoryLetter?: boolean; segment: Segment; at: Date;
  consents: { marketing: boolean; channelOptouts: string[]; dnc: boolean };
  status: CustomerStatus; paused: boolean; anyDpd: boolean; activeNote: boolean; returnedChequeListed: boolean;
  rmApproved: boolean; sentAt: Date[];
};
export type GuardVerdict = { allow: true; version: number; window?: string } | { allow: false; reason: string; clause: string; version: number };

export function guard(i: GuardInput, policy: Policy): GuardVerdict {
  const v = policy.version;
  const block = (reason: string, clause: string): GuardVerdict => ({ allow: false, reason, clause, version: v });
  if (i.consents.dnc && !(i.regulatoryLetter && i.channel === 'LETTER')) return block('Customer is on the do-not-contact list', 'POL-07 §3.2');
  if (i.marketing && !i.consents.marketing) return block('No marketing consent: offers may not be sent', 'POL-07 §2.1');
  if (i.consents.channelOptouts.includes(i.channel)) return block(`Customer opted out of ${i.channel}`, 'POL-07 §3.1');
  if (!policy.list('statusContactable').includes(i.status)) return block(`Status ${i.status} is not contactable`, 'POL-05 §1.1');
  if (i.paused) return block('Case paused: hardship, complaint or dispute open', 'POL-05 §4.1');
  if (i.marketing && policy.bool('suppressIfDpd') && i.anyDpd) return block('Days past due > 0: offers suppressed', 'POL-05 §1.1');
  if (i.marketing && i.activeNote) return block('Cautionary note active: offers suppressed', 'POL-05 §1.1');
  if (i.marketing && i.returnedChequeListed) return block('Returned cheque in the lookback: offers suppressed', 'POL-05 §1.2');
  if (!policy.list('channelEnabled').includes(i.channel)) return block(`Channel ${i.channel} is not enabled`, 'POL-01 §3.2');
  const order = policy.list('channelOrder', i.segment);
  if (i.channel !== 'RM' && i.channel !== 'LETTER' && !order.includes(i.channel)) return block(`${i.channel} is not an allowed channel for ${i.segment}`, 'POL-01 §3.2');
  if (i.channel !== 'RM' && i.channel !== 'LETTER' && policy.bool('rmApprovalRequired', i.segment) && !i.rmApproved) return block(`${i.segment}: no automated message without the RM's approval`, 'POL-01 §6.1');
  const q = quietAt(i.at, i.segment, i.channel, policy);
  if (q) return block(q.reason, q.clause);
  if (i.channel !== 'RM' && i.channel !== 'LETTER') { const c = capBreach(i.sentAt, i.at, i.segment, policy); if (c) return block(c.reason, c.clause); }
  return { allow: true, version: v };
}
