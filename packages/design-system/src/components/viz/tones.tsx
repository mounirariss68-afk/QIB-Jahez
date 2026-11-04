/**
 * What every picture shares: the tones, the default number format, the
 * mount-once draw flag and the date helpers. Kept here so the picture files
 * (index, flow, compare) draw from one source.
 */
import { useEffect, useState } from 'react';

export type Tone = 'primary' | 'warn' | 'danger' | 'success' | 'muted';
export type Format = (v: number) => string;

export const BG: Record<Tone, string> = { primary: 'bg-primary', warn: 'bg-warn', danger: 'bg-danger', success: 'bg-success', muted: 'bg-muted-foreground/45' };
export const TEXT: Record<Tone, string> = { primary: 'text-primary', warn: 'text-warn', danger: 'text-danger', success: 'text-success', muted: 'text-muted-foreground' };
export const STROKE: Record<Tone, string> = { primary: 'stroke-primary', warn: 'stroke-warn', danger: 'stroke-danger', success: 'stroke-success', muted: 'stroke-muted-foreground/50' };
export const FILL: Record<Tone, string> = { primary: 'fill-primary', warn: 'fill-warn', danger: 'fill-danger', success: 'fill-success', muted: 'fill-muted-foreground/50' };

export const DAY = 86_400_000;
export const t = (iso: string) => Date.parse(String(iso).slice(0, 10));
export const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v));
export const plainNumber: Format = (v) => v.toLocaleString('en-GB', { maximumFractionDigits: 1 });
/** "21 Oct" — the default date label. */
export const shortDate = (iso: string | null | undefined) => (iso ? new Date(t(iso)).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' }) : '—');

/** False on the first frame, true after: lets a picture draw once on mount. */
export function useDrawn() {
  const [drawn, setDrawn] = useState(false);
  useEffect(() => {
    const id = window.setTimeout(() => setDrawn(true), 30);
    return () => window.clearTimeout(id);
  }, []);
  return drawn;
}

/** Text drawn over a chart keeps a halo of the background so it stays legible on any fill. */
export const halo = { paintOrder: 'stroke' as const, stroke: 'hsl(var(--background))', strokeWidth: 3, strokeLinejoin: 'round' as const };

/** One shared [min, max] across several series, so small multiples are drawn on one scale. */
export function sharedDomain(series: number[][], { zero = false, pad = 0 }: { zero?: boolean; pad?: number } = {}): [number, number] {
  const all = series.flat().filter((v) => Number.isFinite(v));
  if (!all.length) return [0, 1];
  let lo = Math.min(...all), hi = Math.max(...all);
  if (zero) lo = Math.min(0, lo);
  const p = (hi - lo || Math.abs(hi) || 1) * pad;
  return [lo - (zero && lo === 0 ? 0 : p), hi + p];
}
