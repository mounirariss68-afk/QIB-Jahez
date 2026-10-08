/**
 * Contact calendar (POL-01 windows, POL-09 quiet periods). Doha is UTC+3 all
 * year. `nextAllowed` is what Munadi uses to schedule a message and what Hami
 * uses to block one that is about to leave outside its window.
 */
import type { Policy } from './policy.js';
import type { Channel, Segment } from './types.js';

export const DOHA_OFFSET_MIN = 180;

export function doha(d: Date) {
  const t = new Date(d.getTime() + DOHA_OFFSET_MIN * 60_000);
  return { date: t.toISOString().slice(0, 10), hm: t.toISOString().slice(11, 16), dow: t.getUTCDay(), minutes: t.getUTCHours() * 60 + t.getUTCMinutes() };
}
/** A Doha-local date and HH:MM back to an instant. */
export function fromDoha(date: string, hm: string): Date { return new Date(Date.parse(`${date}T${hm}:00Z`) - DOHA_OFFSET_MIN * 60_000); }
const mins = (hm: string) => { const [h, m] = hm.split(':').map(Number); return h * 60 + (m || 0); };

export const isHoliday = (date: string, policy: Policy) => policy.list('holidays').includes(date);
export const isWeekend = (date: string, policy: Policy) => policy.list('weekend').includes(String(new Date(date + 'T00:00:00Z').getUTCDay()));
export const inRamadan = (date: string, policy: Policy) => date >= policy.str('ramadanStart') && date <= policy.str('ramadanEnd');
export const isBusinessDay = (date: string, policy: Policy) => !isWeekend(date, policy) && !isHoliday(date, policy);
export function addBusinessDays(date: string, n: number, policy: Policy): string {
  const d = new Date(date + 'T00:00:00Z'); let left = n;
  while (left > 0) { d.setUTCDate(d.getUTCDate() + 1); if (isBusinessDay(d.toISOString().slice(0, 10), policy)) left--; }
  return d.toISOString().slice(0, 10);
}

/** The window that applies to a channel on a date, for a segment. */
export function windowFor(segment: Segment, channel: Channel, policy: Policy, date: string): { start: string; end: string; basis: string } {
  const call = channel === 'CALL';
  let start = policy.str(call ? 'callWindowStart' : 'serviceWindowStart', segment);
  let end = policy.str(call ? 'callWindowEnd' : 'serviceWindowEnd', segment);
  let basis = call ? 'POL-01 §2.2' : 'POL-01 §2.1';
  if (inRamadan(date, policy)) {
    const rs = policy.str('ramadanWindowStart'), re = policy.str('ramadanWindowEnd');
    if (mins(rs) > mins(start)) start = rs;
    if (mins(re) < mins(end)) end = re;
    basis = 'POL-09 §2.1';
  }
  return { start, end, basis };
}

export type Quiet = { reason: string; clause: string } | null;

/** Why this instant is not allowed for an outbound contact, or null. RM and LETTER are not windowed (a person or the post decides). */
export function quietAt(at: Date, segment: Segment, channel: Channel, policy: Policy): Quiet {
  if (channel === 'RM' || channel === 'LETTER') return null;
  const { date, hm, dow } = doha(at);
  if (isHoliday(date, policy)) return { reason: `Public holiday ${date}`, clause: 'POL-09 §1.2' };
  if (dow === 5 && mins(hm) >= mins(policy.str('fridayQuietStart')) && mins(hm) < mins(policy.str('fridayQuietEnd'))) return { reason: `Friday quiet window ${policy.str('fridayQuietStart')}–${policy.str('fridayQuietEnd')}`, clause: 'POL-09 §1.1' };
  const w = windowFor(segment, channel, policy, date);
  if (mins(hm) < mins(w.start) || mins(hm) >= mins(w.end)) return { reason: `Outside the ${channel === 'CALL' ? 'call' : 'service'} window ${w.start}–${w.end} Doha${inRamadan(date, policy) ? ' (Ramadan)' : ''}`, clause: w.basis };
  return null;
}

/** The first instant at or after `from` when a contact on this channel is allowed. Searches 45 days. */
export function nextAllowed(from: Date, segment: Segment, channel: Channel, policy: Policy): Date {
  if (channel === 'RM' || channel === 'LETTER') return from;
  let t = new Date(from);
  for (let i = 0; i < 45 * 24; i++) {
    const q = quietAt(t, segment, channel, policy);
    if (!q) return t;
    const { date, hm, dow } = doha(t);
    const w = windowFor(segment, channel, policy, date);
    if (isHoliday(date, policy)) { t = fromDoha(nextDate(date), w.start); continue; }
    if (dow === 5 && mins(hm) < mins(policy.str('fridayQuietEnd')) && mins(hm) >= mins(policy.str('fridayQuietStart'))) { t = fromDoha(date, policy.str('fridayQuietEnd')); continue; }
    if (mins(hm) < mins(w.start)) { t = fromDoha(date, w.start); continue; }
    t = fromDoha(nextDate(date), windowFor(segment, channel, policy, nextDate(date)).start);
  }
  return t;
}
const nextDate = (date: string) => { const d = new Date(date + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + 1); return d.toISOString().slice(0, 10); };

/** Count of contacts already made that a new one would breach, against the per-day/week/30-day caps. */
export function capBreach(sentAt: Date[], at: Date, segment: Segment, policy: Policy): Quiet {
  const dayStart = new Date(at.getTime() - 24 * 3600_000), weekStart = new Date(at.getTime() - 7 * 24 * 3600_000), monthStart = new Date(at.getTime() - 30 * 24 * 3600_000);
  const n = (since: Date) => sentAt.filter((s) => s > since && s <= at).length;
  if (n(dayStart) >= policy.num('maxContactsPerDay', segment)) return { reason: `Already ${n(dayStart)} contact(s) in 24 hours (cap ${policy.num('maxContactsPerDay', segment)})`, clause: 'POL-01 §3.1' };
  const wk = policy.num('maxContactsPerWeek', segment);
  if (wk < 1 ? n(new Date(at.getTime() - (7 / wk) * 24 * 3600_000)) >= 1 : n(weekStart) >= wk) return { reason: `Weekly cap reached (${wk < 1 ? `1 per ${Math.round(7 / wk)} days` : `${wk} per week`})`, clause: 'POL-01 §3.1' };
  if (n(monthStart) >= policy.num('maxContactsPer30d', segment)) return { reason: `30-day cap reached (${policy.num('maxContactsPer30d', segment)})`, clause: 'POL-01 §3.1' };
  return null;
}
