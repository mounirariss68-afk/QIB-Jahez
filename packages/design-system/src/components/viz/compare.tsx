/**
 * Pictures for comparing many items at once: the gap per item (Dumbbell),
 * who moved up or down (Bump), when or where it peaks (Heatmap), whether a
 * spike is a signal or noise (ControlChart), how every item spreads against a
 * limit (DotStrip), and the same picture per item on one scale
 * (SmallMultiples). Same contract as the rest of the kit.
 */
import { useState, type ReactNode } from 'react';
import { cn } from '../../lib/utils';
import { trs } from '../../lib/i18n';
import { FILL, STROKE, clamp, halo, plainNumber, useDrawn, type Format, type Tone } from './tones';

const ellipsis = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

/* ------------------------------------------------------------- Dumbbell */

export type DumbbellRow = { id: string; label: string; from: number | null; to: number | null; target?: number | null; detail?: string };

/**
 * The gap between two values per item, every item on one scale: the hollow
 * dot is where it was (or the plan), the filled dot is where it is. With a
 * target, an item that has not reached it is drawn in the warning tone.
 */
export function Dumbbell({ rows, direction = 'up', min, max, format = plainNumber, legend = ['before', 'now'], onOpen, className }: { rows: DumbbellRow[]; direction?: 'up' | 'down'; min?: number; max?: number; format?: Format; legend?: [string, string]; onOpen?: (id: string) => void; className?: string }) {
  const vals = rows.flatMap((r) => [r.from, r.to, r.target]).filter((v): v is number => typeof v === 'number');
  if (!vals.length) return null;
  const lo = min ?? Math.min(0, ...vals);
  const hi = max ?? Math.max(...vals) * 1.08;
  const x = (v: number) => `${(clamp((v - lo) / (hi - lo || 1)) * 100).toFixed(2)}%`;
  return (
    <div className={cn('space-y-1.5', className)}>
      {rows.map((r, i) => {
        const missed = typeof r.to === 'number' && typeof r.target === 'number' ? (direction === 'up' ? r.to < r.target : r.to > r.target) : false;
        const a = r.from ?? r.to, b = r.to ?? r.from;
        return (
          <div key={r.id} className={cn('flex items-center gap-2', onOpen && 'cursor-pointer rounded hover:bg-primary/5')} onClick={() => onOpen?.(r.id)} title={`${r.label}: ${r.from != null ? format(r.from) : '—'} → ${r.to != null ? format(r.to) : '—'}${r.target != null ? `; target ${format(r.target)}` : ''}${r.detail ? `; ${r.detail}` : ''}`}>
            <span className="w-[32%] truncate text-end text-[12px]">{r.label}</span>
            <div className="relative h-5 flex-1">
              <div className="absolute inset-x-0 top-1/2 h-px bg-border" />
              {typeof a === 'number' && typeof b === 'number' ? <div className={cn('viz-grow absolute top-1/2 h-1 -translate-y-1/2 rounded-full', missed ? 'bg-warn/50' : 'bg-primary/40')} style={{ insetInlineStart: x(Math.min(a, b)), width: `calc(${x(Math.max(a, b))} - ${x(Math.min(a, b))})`, animationDelay: `${i * 60}ms` }} /> : null}
              {typeof r.target === 'number' ? <div className="absolute top-0.5 h-4 w-0.5 -translate-x-1/2 rtl:translate-x-1/2 bg-foreground/70" style={{ insetInlineStart: x(r.target) }} /> : null}
              {typeof r.from === 'number' ? <div className="absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 rtl:translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-foreground/60 bg-background" style={{ insetInlineStart: x(r.from) }} /> : null}
              {typeof r.to === 'number' ? <div className={cn('absolute top-1/2 h-3 w-3 -translate-x-1/2 rtl:translate-x-1/2 -translate-y-1/2 rounded-full', missed ? 'bg-warn' : 'bg-primary')} style={{ insetInlineStart: x(r.to) }} /> : null}
            </div>
            <span className={cn('w-14 shrink-0 text-end text-[11px] font-semibold tabular-nums', missed && 'text-warn')}>{r.to != null ? format(r.to) : '—'}</span>
          </div>
        );
      })}
      <div className="flex gap-4 ps-[34%] pt-1 text-[10.5px] text-muted-foreground">
        <span className="inline-flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full border-2 border-foreground/60" />{trs(legend[0])}</span>
        <span className="inline-flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full bg-primary" />{trs(legend[1])}</span>
        {rows.some((r) => typeof r.target === 'number') ? <span className="inline-flex items-center gap-1"><span className="inline-block h-3 w-0.5 bg-foreground/70" />{trs('target')}</span> : null}
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------- Bump */

export type BumpItem = { id: string; label: string; ranks: (number | null)[]; tone?: Tone };

/**
 * Who moved up or down: each item's rank per period, first place at the top.
 * Shows position only, not the size of the gaps; keep it under ten lines.
 * `focus` lifts the items the screen is about; the rest stay grey.
 */
export function Bump({ periods, items, focus = [], height, onOpen, className }: { periods: string[]; items: BumpItem[]; focus?: string[]; height?: number; onOpen?: (id: string) => void; className?: string }) {
  const [hover, setHover] = useState<string | null>(null);
  const drawn = useDrawn();
  const n = Math.max(1, ...items.flatMap((i) => i.ranks.filter((r): r is number => typeof r === 'number')));
  const W = 480, H = height ?? Math.max(120, n * 24 + 30), L = 100, R = 100, T = 18, B = 8;
  const x = (k: number) => L + (periods.length === 1 ? 0 : (k / (periods.length - 1)) * (W - L - R));
  const y = (r: number) => T + ((r - 1) / Math.max(1, n - 1)) * (H - T - B - 10);
  const lifted = (id: string) => (hover ? hover === id : focus.length ? focus.includes(id) : true);
  const ordered = [...items].sort((a, b) => Number(lifted(a.id)) - Number(lifted(b.id)));
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={cn('viz-svg block h-auto w-full max-w-full', className)} role="img" aria-label="Rank per period">
      {periods.map((p, k) => <text key={p} x={x(k)} y={10} textAnchor="middle" className="fill-muted-foreground text-[9.5px]">{p}</text>)}
      {ordered.map((it) => {
        const on = lifted(it.id);
        const tone = on ? (it.tone ?? 'primary') : 'muted';
        const pts = it.ranks.map((r, k) => (typeof r === 'number' ? { k, r } : null)).filter((p): p is { k: number; r: number } => Boolean(p));
        if (!pts.length) return null;
        const d = pts.map((p, j) => (j === 0 ? `M${x(p.k)},${y(p.r)}` : `C${(x(pts[j - 1].k) + x(p.k)) / 2},${y(pts[j - 1].r)} ${(x(pts[j - 1].k) + x(p.k)) / 2},${y(p.r)} ${x(p.k)},${y(p.r)}`)).join(' ');
        const first = pts[0], last = pts[pts.length - 1];
        const moved = first.r - last.r;
        return (
          <g key={it.id} className={cn(onOpen && 'cursor-pointer')} onMouseEnter={() => setHover(it.id)} onMouseLeave={() => setHover(null)} onClick={() => onOpen?.(it.id)}>
            <path d={d} fill="none" strokeWidth={on ? 3 : 1.5} strokeLinecap="round" className={cn(STROKE[tone], 'viz-draw', drawn && 'is-drawn')} pathLength={1} />
            {pts.map((p) => <circle key={p.k} cx={x(p.k)} cy={y(p.r)} r={on ? 4 : 2.5} className={FILL[tone]} />)}
            <text x={x(first.k) - 8} y={y(first.r) + 3.5} textAnchor="end" className={cn('text-[10px]', on ? 'fill-foreground' : 'fill-muted-foreground')}>{ellipsis(it.label, 20)} {first.r}</text>
            <text x={x(last.k) + 8} y={y(last.r) + 3.5} className={cn('text-[10px]', on ? 'fill-foreground font-semibold' : 'fill-muted-foreground')}>
              {last.r} {ellipsis(it.label, 16)}
              {on && moved ? <tspan className={moved > 0 ? 'fill-success' : 'fill-danger'}> {moved > 0 ? `▲${moved}` : `▼${-moved}`}</tspan> : null}
            </text>
            <title>{`${it.label}: ${it.ranks.map((r, k) => `${periods[k]} ${r ?? '—'}`).join(', ')}`}</title>
          </g>
        );
      })}
    </svg>
  );
}

/* -------------------------------------------------------------- Heatmap */

/**
 * Intensity across two dimensions (hour by weekday, branch by month), in one
 * hue from pale to full. The highest cell is outlined. Empty cells stay empty.
 */
export function Heatmap({ rows, cols, values, format = plainNumber, showValues = false, className }: { rows: string[]; cols: string[]; values: (number | null)[][]; format?: Format; showValues?: boolean; className?: string }) {
  const flat = values.flat().filter((v): v is number => typeof v === 'number');
  const max = Math.max(1e-9, ...flat);
  const top = Math.max(...flat);
  const pi = values.findIndex((row) => row.some((v) => v === top));
  const peak: [number, number] | null = pi >= 0 ? [pi, values[pi].findIndex((v) => v === top)] : null;
  const every = Math.ceil(cols.length / 12);
  return (
    <div className={cn('min-w-0', className)}>
      <div className="grid gap-[2px]" style={{ gridTemplateColumns: `minmax(48px, max-content) repeat(${cols.length}, minmax(0, 1fr))` }}>
        <span />
        {cols.map((c, j) => <span key={c} className="truncate text-center text-[9px] text-muted-foreground">{j % every === 0 ? c : ''}</span>)}
        {rows.map((r, i) => (
          <div key={r} className="contents">
            <span className="truncate pe-2 text-end text-[10.5px] leading-5 text-muted-foreground">{r}</span>
            {cols.map((c, j) => {
              const v = values[i]?.[j];
              const isPeak = peak !== null && peak[0] === i && peak[1] === j;
              return (
                <div key={c} className={cn('viz-rise relative h-5 rounded-[3px]', typeof v !== 'number' && 'bg-muted/40', isPeak && 'ring-2 ring-foreground/70 ring-offset-1 ring-offset-background')} style={{ background: typeof v === 'number' ? `hsl(var(--primary) / ${(0.08 + 0.92 * (v / max)).toFixed(2)})` : undefined, animationDelay: `${(i + j) * 12}ms` }} title={`${r}, ${c}: ${typeof v === 'number' ? format(v) : 'no data'}`}>
                  {showValues && typeof v === 'number' ? <span className="absolute inset-0 flex items-center justify-center text-[9px] tabular-nums text-primary-foreground">{format(v)}</span> : null}
                </div>
              );
            })}
          </div>
        ))}
      </div>
      <div className="mt-2 flex items-center justify-end gap-1.5 text-[10px] text-muted-foreground">
        <span>{format(Math.min(...flat, max))}</span>
        <span className="h-2 w-20 rounded-full" style={{ background: 'linear-gradient(to right, hsl(var(--primary) / .1), hsl(var(--primary)))' }} />
        <span>{format(max)}</span>
      </div>
    </div>
  );
}

/* --------------------------------------------------------- ControlChart */

/**
 * The limits of normal variation for a measured series (an individuals chart):
 * the centre is the mean of the first `baseline` points, the limits are three
 * sigma from it, sigma estimated from the average moving range. A point
 * outside the limits, or eight in a row on one side of the centre, is a
 * signal; anything else is noise.
 */
export function controlLimits(values: number[], baseline?: number) {
  const base = values.slice(0, Math.max(2, baseline ?? values.length));
  const mean = base.reduce((s, v) => s + v, 0) / base.length;
  const mr = base.slice(1).map((v, i) => Math.abs(v - base[i]));
  const sigma = mr.length ? mr.reduce((s, v) => s + v, 0) / mr.length / 1.128 : 0;
  const ucl = mean + 3 * sigma, lcl = mean - 3 * sigma;
  const outside = values.map((v, i) => (v > ucl || v < lcl ? i : -1)).filter((i) => i >= 0);
  const run: number[] = [];
  let side = 0, len = 0;
  values.forEach((v, i) => {
    const s = v > mean ? 1 : v < mean ? -1 : 0;
    len = s !== 0 && s === side ? len + 1 : s !== 0 ? 1 : 0;
    side = s;
    if (len >= 8) for (let k = i - len + 1; k <= i; k++) if (!run.includes(k)) run.push(k);
  });
  return { mean, sigma, ucl, lcl, outside, run };
}

export function ControlChart({ points, baseline, floor, format = plainNumber, height = 150, className }: { points: { label: string; value: number }[]; baseline?: number; floor?: number; format?: Format; height?: number; className?: string }) {
  const drawn = useDrawn();
  if (points.length < 3) return <div className={cn('h-20 rounded bg-muted/40', className)} />;
  const v = points.map((p) => p.value);
  const lim = controlLimits(v, baseline);
  const lcl = typeof floor === 'number' ? Math.max(floor, lim.lcl) : lim.lcl;
  const W = 640, H = height, T = 10, B = 18, L = 4, R = 92;
  const lo = Math.min(lcl, ...v), hi = Math.max(lim.ucl, ...v);
  const pad = (hi - lo || 1) * 0.08;
  const x = (i: number) => L + (i / (points.length - 1)) * (W - L - R);
  const y = (val: number) => T + (1 - (val - (lo - pad)) / (hi + pad - (lo - pad))) * (H - T - B);
  const path = v.map((val, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(val).toFixed(1)}`).join(' ');
  const line = (val: number, label: string, cls: string, dash?: string) => (
    <g>
      <line x1={L} x2={W - R} y1={y(val)} y2={y(val)} className={cls} strokeDasharray={dash} />
      <text x={W - R + 6} y={y(val) + 3} className="fill-muted-foreground text-[9px]">{label} {format(val)}</text>
    </g>
  );
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={cn('viz-svg block h-auto w-full max-w-full', className)} role="img" aria-label={lim.outside.length ? `${lim.outside.length} points outside normal variation` : 'Within normal variation'}>
      <rect x={L} y={y(lim.ucl)} width={W - L - R} height={Math.max(0, y(lcl) - y(lim.ucl))} className="fill-muted/50" />
      {line(lim.ucl, trs('upper'), 'stroke-foreground/40', '4 3')}
      {line(lim.mean, trs('mean'), 'stroke-foreground/60')}
      {line(lcl, trs('lower'), 'stroke-foreground/40', '4 3')}
      {typeof baseline === 'number' && baseline < points.length ? <line x1={x(baseline - 0.5)} x2={x(baseline - 0.5)} y1={T} y2={H - B} className="stroke-border" strokeDasharray="2 2" /> : null}
      <path d={path} fill="none" strokeWidth={1.5} className={cn('stroke-primary viz-draw', drawn && 'is-drawn')} pathLength={1} />
      {v.map((val, i) => {
        const out = lim.outside.includes(i), run = lim.run.includes(i);
        return (
          <circle key={i} cx={x(i)} cy={y(val)} r={out ? 4.5 : run ? 3.5 : 2.2} className={out ? 'fill-danger' : run ? 'fill-warn' : 'fill-primary'}>
            <title>{`${points[i].label}: ${format(val)}${out ? ' — outside normal variation' : run ? ' — part of a run on one side' : ''}`}</title>
          </circle>
        );
      })}
      {[0, points.length - 1].map((i) => <text key={i} x={x(i)} y={H - 4} textAnchor={i ? 'end' : 'start'} className="fill-muted-foreground text-[9px]">{points[i].label}</text>)}
    </svg>
  );
}

/* ------------------------------------------------------------- DotStrip */

export type StripItem = { id: string; label: string; value: number; tone?: Tone; detail?: string };

/**
 * Every item as a dot on one axis, stacked where they would overlap (a
 * beeswarm), with limits marked: every case's age against the service level.
 */
export function DotStrip({ items, marks = [], min, max, format = plainNumber, onOpen, className }: { items: StripItem[]; marks?: { value: number; label: string; tone?: Tone }[]; min?: number; max?: number; format?: Format; onOpen?: (id: string) => void; className?: string }) {
  const drawn = useDrawn();
  const W = 640, r = 5, L = 8, R = 8;
  const vals = [...items.map((i) => i.value), ...marks.map((m) => m.value)];
  const lo = min ?? Math.min(0, ...vals), hi = max ?? Math.max(1, ...vals) * 1.05;
  const x = (v: number) => L + clamp((v - lo) / (hi - lo || 1)) * (W - L - R);
  const placed: { i: StripItem; x: number; dy: number }[] = [];
  for (const i of [...items].sort((a, b) => a.value - b.value)) {
    const cx = x(i.value);
    let dy = 0;
    for (let k = 0; k < 40; k++) {
      dy = (k % 2 ? 1 : -1) * Math.ceil(k / 2) * (2 * r + 1);
      if (!placed.some((p) => Math.abs(p.x - cx) < 2 * r + 1 && Math.abs(p.dy - dy) < 2 * r + 1)) break;
    }
    placed.push({ i, x: cx, dy });
  }
  const spread = Math.max(r * 2, ...placed.map((p) => Math.abs(p.dy) + r + 2));
  const H = spread * 2 + 34, mid = spread + 14;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={cn('viz-svg block h-auto w-full max-w-full', className)} role="img" aria-label="Every item on one axis">
      <line x1={L} x2={W - R} y1={H - 16} y2={H - 16} className="stroke-border" />
      {[lo, (lo + hi) / 2, hi].map((v, k) => <text key={k} x={x(v)} y={H - 4} textAnchor={k === 0 ? 'start' : k === 2 ? 'end' : 'middle'} className="fill-muted-foreground text-[9px]">{format(v)}</text>)}
      {marks.map((m) => (
        <g key={m.label}>
          <line x1={x(m.value)} x2={x(m.value)} y1={6} y2={H - 16} className={m.tone ? STROKE[m.tone] : 'stroke-foreground/70'} strokeWidth={1.5} strokeDasharray="3 3" />
          <text x={x(m.value) + 4} y={12} className={cn('text-[9.5px]', m.tone ? FILL[m.tone] : 'fill-foreground')} {...halo}>{m.label}</text>
        </g>
      ))}
      {placed.map(({ i, x: cx, dy }, k) => (
        <circle key={i.id} cx={cx} cy={mid + dy} r={r} className={cn(FILL[i.tone ?? 'primary'], 'stroke-background viz-pop', drawn && 'is-drawn', onOpen && 'cursor-pointer')} strokeWidth={1} style={{ transitionDelay: `${k * 15}ms` }} onClick={() => onOpen?.(i.id)}>
          <title>{`${i.label}: ${format(i.value)}${i.detail ? `; ${i.detail}` : ''}`}</title>
        </circle>
      ))}
    </svg>
  );
}

/* ------------------------------------------------------- SmallMultiples */

/**
 * The same picture for each item, side by side. The panels must share one
 * scale (pass `domain` from sharedDomain to Sparkline, `max` to Columns), or
 * the comparison lies. The panel that matters can be marked.
 */
export function SmallMultiples({ panels, min = 180, className }: { panels: { id: string; title: ReactNode; figure?: ReactNode; tone?: Tone; children: ReactNode }[]; min?: number; className?: string }) {
  return (
    <div className={cn('grid gap-3', className)} style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${min}px, 1fr))` }}>
      {panels.map((p) => (
        <div key={p.id} className={cn('min-w-0 rounded-lg border border-border/60 px-3 py-2.5', p.tone && p.tone !== 'primary' && 'border-s-4', p.tone === 'warn' && 'border-s-warn', p.tone === 'danger' && 'border-s-danger', p.tone === 'success' && 'border-s-success')}>
          <div className="mb-1.5 flex items-baseline justify-between gap-2">
            <span className="truncate text-[12px] font-medium">{p.title}</span>
            {p.figure ? <span className="shrink-0 text-[12px] font-semibold tabular-nums">{p.figure}</span> : null}
          </div>
          {p.children}
        </div>
      ))}
    </div>
  );
}

