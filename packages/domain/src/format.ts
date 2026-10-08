/** Formatting shared by server and web: QAR amounts, dates, Doha times. */
export const qar = (n: number | null | undefined, opts: { compact?: boolean } = {}) => {
  if (n === null || n === undefined || Number.isNaN(n)) return '—';
  if (opts.compact && Math.abs(n) >= 1_000_000) return `QAR ${(n / 1_000_000).toFixed(2)}m`;
  if (opts.compact && Math.abs(n) >= 1_000) return `QAR ${Math.round(n / 1_000)}k`;
  return `QAR ${Math.round(n).toLocaleString('en-US')}`;
};
export const num = (n: number | null | undefined) => (n === null || n === undefined ? '—' : Math.round(n).toLocaleString('en-US'));
export const pct = (n: number | null | undefined, d = 1) => (n === null || n === undefined ? '—' : `${n.toFixed(d)}%`);
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** 2026-10-08 → 8 Oct 2026 */
export const fmtDate = (iso: string | null | undefined) => { if (!iso) return '—'; const [y, m, d] = iso.slice(0, 10).split('-').map(Number); return `${d} ${MONTHS[m - 1]} ${y}`; };
/** Instant → Doha-local "8 Oct 2026, 09:15" */
export const fmtDoha = (at: string | Date | null | undefined) => { if (!at) return '—'; const d = new Date(new Date(at).getTime() + 3 * 3600_000); return `${fmtDate(d.toISOString())}, ${d.toISOString().slice(11, 16)}`; };
export const fmtMonth = (ym: string) => { const [y, m] = ym.split('-').map(Number); return `${MONTHS[m - 1]} ${y}`; };
export const maskQid = (n: string | null | undefined) => (n ? `•••• ${n.slice(-4)}` : '—');
export const relDays = (fromIso: string, toIso: string) => { const d = Math.round((Date.parse(toIso.slice(0, 10)) - Date.parse(fromIso.slice(0, 10))) / 86_400_000); return d === 0 ? 'today' : d > 0 ? `in ${d} day${d === 1 ? '' : 's'}` : `${-d} day${d === -1 ? '' : 's'} ago`; };
