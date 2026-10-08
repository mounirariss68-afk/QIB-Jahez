/** Formatting. Figures stay in Western digits; dates in Doha time. */
export const qar = (n: number | null | undefined) => (n === null || n === undefined || Number.isNaN(Number(n)) ? '—' : `QAR ${Math.round(Number(n)).toLocaleString('en-US')}`);
export const qarShort = (n: number | null | undefined) => { if (n === null || n === undefined) return '—'; const a = Math.abs(Number(n)); const v = a >= 1e6 ? `${(Number(n) / 1e6).toFixed(2)}m` : a >= 1e4 ? `${Math.round(Number(n) / 1e3)}k` : Math.round(Number(n)).toLocaleString('en-US'); return `QAR ${v}`; };
export const num = (n: number | null | undefined, d = 0) => (n === null || n === undefined ? '—' : Number(n).toLocaleString('en-US', { maximumFractionDigits: d, minimumFractionDigits: d }));
export const pct = (n: number | null | undefined, d = 1) => (n === null || n === undefined ? '—' : `${Number(n).toFixed(d)}%`);
const dtf = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Qatar', ...o });
const asDate = (s: string | Date) => new Date(typeof s === 'string' && s.length === 10 ? `${s}T08:00:00Z` : s);
export const date = (s: string | Date | null | undefined) => (s ? dtf({ day: 'numeric', month: 'short', year: 'numeric' }).format(asDate(s)) : '—');
export const dateShort = (s: string | Date | null | undefined) => (s ? dtf({ day: 'numeric', month: 'short' }).format(asDate(s)) : '—');
export const dateTime = (s: string | Date | null | undefined) => (s ? dtf({ day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(s)) : '—');
export const time = (s: string | Date | null | undefined) => (s ? dtf({ hour: '2-digit', minute: '2-digit' }).format(new Date(s)) : '—');
export const month = (ym: string) => { const m = String(ym ?? '').slice(0, 7); return /^\d{4}-\d{2}$/.test(m) ? dtf({ month: 'short', year: '2-digit' }).format(new Date(`${m}-15T08:00:00Z`)) : String(ym ?? '—'); };
/** Relative to the virtual clock. */
export function rel(s: string | Date | null | undefined, now: string | Date = new Date()) {
  if (!s) return '—';
  const d = (new Date(now).getTime() - new Date(s).getTime()) / 1000;
  const a = Math.abs(d); const past = d >= 0;
  const f = (n: number, u: string) => (past ? `${n}${u} ago` : `in ${n}${u}`);
  if (a < 60) return past ? 'just now' : 'now';
  if (a < 3600) return f(Math.round(a / 60), 'm');
  if (a < 86400) return f(Math.round(a / 3600), 'h');
  return f(Math.round(a / 86400), 'd');
}
export const initials = (name: string) => (name ?? '').split(/\s+/).filter((w) => !/^(al|bin|el|al-)$/i.test(w)).map((w) => w.replace(/^al-/i, '')[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();
export const title = (s: string | null | undefined) => (s ? s.toLowerCase().replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase()) : '—');
export const maskQid = (n: string | null | undefined) => (n ? `•••• ${String(n).slice(-4)}` : '—');
