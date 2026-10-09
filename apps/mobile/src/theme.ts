/** QIB colours (from qib.com.qa's stylesheet) and the few sizes the screens share. */
export const C = {
  blue: '#0075B0',        // primary
  navy: '#002E5E',        // dark blue
  sky: '#00A1DE',         // light blue
  skySoft: '#CCE3EF',
  orange: '#DF7A00',      // accent
  ink: '#00111A',
  muted: '#4A5A68',
  line: '#D9E1E8',
  bg: '#F3F6F9',
  card: '#FFFFFF',
  ok: '#1B7F4E',
  okSoft: '#DFF3E8',
  warn: '#9A6A00',
  warnSoft: '#FFF1D6',
  danger: '#B42318',
  dangerSoft: '#FDE2E0',
};
export const R = { sm: 10, md: 14, lg: 20 };
export const SP = { xs: 6, sm: 10, md: 16, lg: 24 };

export const qar = (n: number | string | null | undefined) => {
  const v = Number(n ?? 0);
  return `QAR ${v.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
};
export const dateShort = (iso: string | null | undefined, lang: 'en' | 'ar' = 'en') => {
  if (!iso) return '—';
  const d = new Date(iso.length === 10 ? iso + 'T00:00:00Z' : iso);
  return d.toLocaleDateString(lang === 'ar' ? 'ar-QA' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Qatar' });
};
export const dateTime = (iso: string | null | undefined, lang: 'en' | 'ar' = 'en') => {
  if (!iso) return '—';
  return new Date(iso).toLocaleString(lang === 'ar' ? 'ar-QA' : 'en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Qatar' });
};
