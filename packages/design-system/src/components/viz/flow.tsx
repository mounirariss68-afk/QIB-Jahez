/**
 * Pictures of movement: how a value got from one figure to another
 * (Waterfall), where a total goes (Sankey), where people drop out (Funnel),
 * where work piles up (CumulativeFlow) and who is connected to whom
 * (Network). Same contract as the rest of the kit: plain values in, a
 * `format` function for numbers, theme tokens for colour, drawn once on mount.
 *
 * Widths of ribbons and positions in a network are read only roughly, so each
 * of these prints its numbers beside the picture.
 */
import { useMemo, useState } from 'react';
import { cn } from '../../lib/utils';
import { trs } from '../../lib/i18n';
import { FILL, clamp, halo, plainNumber, shortDate, useDrawn, type Format, type Tone } from './tones';

const ellipsis = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

/* ------------------------------------------------------------ Waterfall */

export type WaterfallStep = { label: string; value: number; detail?: string };

/**
 * How a start figure became an end figure, one change at a time (a bridge).
 * The totals are in the quantity hue; each change is green when it moves the
 * figure the good way and red when it does not (`good` says which way that is).
 */
export function Waterfall({ start, steps, end = 'Now', good = 'up', format = plainNumber, height = 180, className }: { start: { label: string; value: number }; steps: WaterfallStep[]; end?: string; good?: 'up' | 'down'; format?: Format; height?: number; className?: string }) {
  const drawn = useDrawn();
  const bars: { label: string; from: number; to: number; kind: 'total' | 'good' | 'bad'; detail?: string }[] = [{ label: start.label, from: 0, to: start.value, kind: 'total' }];
  let run = start.value;
  for (const s of steps) {
    const next = run + s.value;
    const isGood = good === 'up' ? s.value >= 0 : s.value <= 0;
    bars.push({ label: s.label, from: run, to: next, kind: isGood ? 'good' : 'bad', detail: s.detail });
    run = next;
  }
  if (steps.length) bars.push({ label: end, from: 0, to: run, kind: 'total' });
  const W = 600, H = height, T = 18, B = 30, L = 4, R = 4;
  const lo = Math.min(0, ...bars.flatMap((b) => [b.from, b.to]));
  const hi = Math.max(...bars.flatMap((b) => [b.from, b.to]), lo + 1);
  const y = (v: number) => T + (1 - (v - lo) / (hi - lo)) * (H - T - B);
  const band = (W - L - R) / bars.length;
  const bw = Math.min(64, band * 0.62);
  const cx = (i: number) => L + band * i + band / 2;
  const tone = { total: 'fill-primary', good: 'fill-success', bad: 'fill-danger' } as const;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={cn('viz-svg block h-auto w-full max-w-full', className)} role="img" aria-label={`${start.label} ${format(start.value)} to ${end} ${format(run)}`}>
      <line x1={L} x2={W - R} y1={y(0)} y2={y(0)} className="stroke-border" />
      {bars.map((b, i) => {
        const top = y(Math.max(b.from, b.to)), bottom = y(Math.min(b.from, b.to));
        const delta = b.to - b.from;
        const label = b.kind === 'total' ? format(b.to) : `${delta >= 0 ? '+' : '−'}${format(Math.abs(delta))}`;
        return (
          <g key={i}>
            {i < bars.length - 1 ? <line x1={cx(i) + bw / 2} x2={cx(i + 1) - bw / 2} y1={y(b.to)} y2={y(b.to)} className="stroke-foreground/35" strokeDasharray="2 2" /> : null}
            <rect x={cx(i) - bw / 2} y={top} width={bw} height={Math.max(1.5, bottom - top)} rx={2} className={cn(tone[b.kind], b.kind !== 'total' && 'opacity-80', 'transition-transform duration-700')} style={{ transformBox: 'fill-box', transformOrigin: delta < 0 && b.kind !== 'total' ? 'center top' : 'center bottom', transform: drawn ? 'scaleY(1)' : 'scaleY(0)', transitionDelay: `${i * 80}ms` }}>
              <title>{`${b.label}: ${label}${b.kind !== 'total' ? `, ${format(b.from)} → ${format(b.to)}` : ''}${b.detail ? `; ${b.detail}` : ''}`}</title>
            </rect>
            <text x={cx(i)} y={top - 5} textAnchor="middle" className={cn('text-[10px] tabular-nums', b.kind === 'total' ? 'fill-foreground font-semibold' : 'fill-foreground/80')}>{label}</text>
            <text x={cx(i)} y={H - 14} textAnchor="middle" className="fill-muted-foreground text-[9.5px]">{ellipsis(b.label, Math.max(6, Math.floor(band / 6)))}</text>
          </g>
        );
      })}
    </svg>
  );
}

/* --------------------------------------------------------------- Sankey */

export type SankeyNode = { id: string; label: string; tone?: Tone };
export type SankeyLink = { source: string; target: string; value: number };

/**
 * Where a total goes: stages left to right, each node as tall as what passes
 * through it, each ribbon as wide as its flow. Keep it under about twenty
 * ribbons; group the small ones as "Other". A ribbon takes its target's tone,
 * so the flows that end somewhere that matters stand out.
 */
export function Sankey({ nodes, links, format = plainNumber, height = 260, onOpen, className }: { nodes: SankeyNode[]; links: SankeyLink[]; format?: Format; height?: number; onOpen?: (id: string) => void; className?: string }) {
  const [hover, setHover] = useState<string | null>(null);
  const drawn = useDrawn();
  const layout = useMemo(() => {
    const W = 640, H = height, padY = 10, nodeW = 10, gap = 10;
    const ls = links.filter((l) => l.value > 0 && l.source !== l.target);
    const ins = new Map<string, number>(), outs = new Map<string, number>();
    for (const l of ls) {
      outs.set(l.source, (outs.get(l.source) ?? 0) + l.value);
      ins.set(l.target, (ins.get(l.target) ?? 0) + l.value);
    }
    const used = nodes.filter((n) => ins.has(n.id) || outs.has(n.id));
    // Column = longest path from a source.
    const col = new Map<string, number>(used.map((n) => [n.id, 0]));
    for (let k = 0; k < used.length; k++) for (const l of ls) if ((col.get(l.target) ?? 0) < (col.get(l.source) ?? 0) + 1) col.set(l.target, (col.get(l.source) ?? 0) + 1);
    const nCols = Math.max(...col.values(), 0) + 1;
    const value = (id: string) => Math.max(ins.get(id) ?? 0, outs.get(id) ?? 0);
    const cols: SankeyNode[][] = Array.from({ length: nCols }, () => []);
    for (const n of used) cols[col.get(n.id)!].push(n);
    const k = Math.min(...cols.map((c) => (H - 2 * padY - gap * Math.max(0, c.length - 1)) / Math.max(1, c.reduce((s, n) => s + value(n.id), 0))));
    const x = (c: number) => 4 + (nCols === 1 ? 0 : (c / (nCols - 1)) * (W - nodeW - 8));
    const pos = new Map<string, { x: number; y: number; h: number; c: number }>();
    const place = (c: number) => {
      const list = cols[c];
      const total = list.reduce((s, n) => s + value(n.id) * k, 0) + gap * Math.max(0, list.length - 1);
      let yy = padY + (H - 2 * padY - total) / 2;
      for (const n of list) {
        pos.set(n.id, { x: x(c), y: yy, h: Math.max(2, value(n.id) * k), c });
        yy += value(n.id) * k + gap;
      }
    };
    place(0);
    for (let c = 1; c < nCols; c++) {
      // Order each column by where its flows come from, so ribbons cross less.
      const centre = (id: string) => {
        const inc = ls.filter((l) => l.target === id && pos.has(l.source));
        const w = inc.reduce((s, l) => s + l.value, 0) || 1;
        return inc.reduce((s, l) => s + (pos.get(l.source)!.y + pos.get(l.source)!.h / 2) * l.value, 0) / w;
      };
      cols[c].sort((a, b) => centre(a.id) - centre(b.id));
      place(c);
    }
    const outOff = new Map<string, number>(), inOff = new Map<string, number>();
    const sorted = [...ls].sort((a, b) => pos.get(a.target)!.y - pos.get(b.target)!.y || pos.get(a.source)!.y - pos.get(b.source)!.y);
    const ribbons = sorted.map((l) => {
      const s = pos.get(l.source)!, d = pos.get(l.target)!;
      const w = l.value * k;
      const y0 = s.y + (outOff.get(l.source) ?? 0);
      outOff.set(l.source, (outOff.get(l.source) ?? 0) + w);
      return { l, s, d, w, y0 };
    });
    for (const r of [...ribbons].sort((a, b) => a.s.y - b.s.y)) {
      (r as typeof r & { y1: number }).y1 = r.d.y + (inOff.get(r.l.target) ?? 0);
      inOff.set(r.l.target, (inOff.get(r.l.target) ?? 0) + r.w);
    }
    return { W, H, nodeW, pos, ribbons: ribbons as (typeof ribbons[number] & { y1: number })[], nCols, value };
  }, [nodes, links, height]);
  const { W, H, nodeW, pos, ribbons, nCols, value } = layout;
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const lit = (l: SankeyLink) => !hover || l.source === hover || l.target === hover;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={cn('viz-svg block h-auto w-full max-w-full', className)} role="img" aria-label="Where the total goes">
      {ribbons.map(({ l, s, d, w, y0, y1 }, i) => {
        const x0 = s.x + nodeW, x1 = d.x, xm = (x0 + x1) / 2;
        const tone = byId.get(l.target)?.tone ?? 'primary';
        return (
          <path key={i} d={`M${x0},${y0} C${xm},${y0} ${xm},${y1} ${x1},${y1} L${x1},${y1 + w} C${xm},${y1 + w} ${xm},${y0 + w} ${x0},${y0 + w} Z`} className={cn(FILL[tone], 'transition-opacity duration-500')} style={{ opacity: drawn ? (lit(l) ? (hover ? 0.5 : 0.28) : 0.08) : 0, transitionDelay: drawn && !hover ? `${s.c * 150}ms` : '0ms' }}>
            <title>{`${byId.get(l.source)?.label ?? l.source} → ${byId.get(l.target)?.label ?? l.target}: ${format(l.value)}`}</title>
          </path>
        );
      })}
      {[...pos.entries()].map(([id, p]) => {
        const n = byId.get(id)!;
        const last = p.c === nCols - 1;
        return (
          <g key={id} className={cn(onOpen && 'cursor-pointer')} onMouseEnter={() => setHover(id)} onMouseLeave={() => setHover(null)} onClick={() => onOpen?.(id)}>
            <rect x={p.x} y={p.y} width={nodeW} height={p.h} rx={2} className={FILL[n.tone ?? 'primary']} />
            <text x={last ? p.x - 6 : p.x + nodeW + 6} y={p.y + p.h / 2 + 3.5} textAnchor={last ? 'end' : 'start'} className="fill-foreground text-[10px]" {...halo}>
              <tspan className="font-medium">{ellipsis(n.label, 22)}</tspan>
              <tspan className="fill-muted-foreground tabular-nums"> {format(value(id))}</tspan>
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/* --------------------------------------------------------------- Funnel */

/**
 * One path with drop-off at each step, on one scale from the first step.
 * The step that loses the largest share is marked: that is where to look.
 */
export function Funnel({ steps, format = plainNumber, className }: { steps: { label: string; value: number }[]; format?: Format; className?: string }) {
  if (!steps.length) return null;
  const first = Math.max(1, steps[0].value);
  const losses = steps.map((s, i) => (i === 0 ? 0 : 1 - s.value / Math.max(1, steps[i - 1].value)));
  const worst = steps.length > 1 ? losses.indexOf(Math.max(...losses.slice(1))) : -1;
  return (
    <div className={cn('space-y-1', className)}>
      {steps.map((s, i) => (
        <div key={s.label}>
          {i > 0 ? (
            <p className={cn('ps-[34%] text-[10.5px] tabular-nums', i === worst ? 'font-medium text-warn' : 'text-muted-foreground')}>
              −{format(steps[i - 1].value - s.value)} {trs('lost here')} ({Math.round(losses[i] * 100)}%)
            </p>
          ) : null}
          <div className="flex items-center gap-2" title={`${s.label}: ${format(s.value)}, ${Math.round((s.value / first) * 100)}% of ${steps[0].label}`}>
            <span className="w-[32%] truncate text-end text-[12px]">{s.label}</span>
            <div className="relative h-5 flex-1">
              <div className={cn('viz-grow absolute inset-y-0 start-0 rounded', i === steps.length - 1 ? 'bg-primary' : 'bg-primary/55')} style={{ width: `${clamp(s.value / first) * 80}%`, animationDelay: `${i * 90}ms` }} />
              <span className="absolute inset-y-0 flex items-center ps-1.5 text-[11px] font-semibold tabular-nums" style={{ insetInlineStart: `${clamp(s.value / first) * 80}%` }}>{format(s.value)}</span>
            </div>
            <span className="w-10 shrink-0 text-end text-[10.5px] tabular-nums text-muted-foreground">{Math.round((s.value / first) * 100)}%</span>
          </div>
        </div>
      ))}
    </div>
  );
}

/* -------------------------------------------------------- CumulativeFlow */

export type FlowDay = { day: string; counts: Record<string, number> };

/**
 * The state whose count grew most over the last `window` days, among the
 * states between the first (waiting) and the last (done): where work piles up.
 * Null when nothing grew.
 */
export function flowBottleneck(states: { id: string; label: string }[], days: FlowDay[], window = 14) {
  if (days.length < 2 || states.length < 3) return null;
  const end = days[days.length - 1];
  const startDay = days[Math.max(0, days.length - 1 - window)];
  let best: { id: string; label: string; growth: number; now: number } | null = null;
  for (const s of states.slice(1, -1)) {
    const growth = (end.counts[s.id] ?? 0) - (startDay.counts[s.id] ?? 0);
    if (growth > 0 && (!best || growth > best.growth)) best = { id: s.id, label: s.label, growth, now: end.counts[s.id] ?? 0 };
  }
  return best;
}

/**
 * Work in each state over time, stacked with done at the bottom: a band that
 * widens is work piling up, the gap across the bands is the lead time. The
 * state that grew most over the last two weeks is drawn in the warning tone.
 */
export function CumulativeFlow({ states, days, window = 14, height = 200, format = plainNumber, className }: { states: { id: string; label: string }[]; days: FlowDay[]; window?: number; height?: number; format?: Format; className?: string }) {
  const drawn = useDrawn();
  if (days.length < 2 || !states.length) return <div className={cn('h-24 rounded bg-muted/40', className)} />;
  const W = 640, H = height, T = 8, B = 20, L = 4, R = 120;
  const order = [...states].reverse(); // done at the bottom
  const totals = days.map((d) => order.reduce((s, st) => s + (d.counts[st.id] ?? 0), 0));
  const max = Math.max(1, ...totals);
  const x = (i: number) => L + (i / (days.length - 1)) * (W - L - R);
  const y = (v: number) => T + (1 - v / max) * (H - T - B);
  const neck = flowBottleneck(states, days, window);
  const cum = days.map((d) => {
    let acc = 0;
    return order.map((st) => (acc += d.counts[st.id] ?? 0));
  });
  const last = days.length - 1;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={cn('viz-svg block h-auto w-full max-w-full', className)} role="img" aria-label={neck ? `Work is piling up in ${neck.label}` : 'Work in each state over time'}>
      <g style={{ clipPath: drawn ? 'inset(0 0 0 0)' : 'inset(0 100% 0 0)', transition: 'clip-path 900ms cubic-bezier(.2,.7,.2,1)' }}>
        {order.map((st, k) => {
          const top = days.map((_, i) => `${x(i).toFixed(1)},${y(cum[i][k]).toFixed(1)}`);
          const bottom = days.map((_, i) => `${x(i).toFixed(1)},${y(k ? cum[i][k - 1] : 0).toFixed(1)}`).reverse();
          const isNeck = neck?.id === st.id;
          const isDone = k === 0;
          const opacity = isDone ? 0.55 : 0.2 + (0.5 * (order.length - 1 - k)) / Math.max(1, order.length - 1);
          return (
            <polygon key={st.id} points={[...top, ...bottom].join(' ')} className={isNeck ? 'fill-warn' : isDone ? 'fill-success' : 'fill-primary'} style={{ opacity: isNeck ? 0.75 : opacity }}>
              <title>{`${st.label}: ${format(days[last].counts[st.id] ?? 0)} now`}</title>
            </polygon>
          );
        })}
      </g>
      {[0, Math.floor(last / 2), last].map((i) => (
        <text key={i} x={x(i)} y={H - 6} textAnchor={i === 0 ? 'start' : i === last ? 'end' : 'middle'} className="fill-muted-foreground text-[9px]">{shortDate(days[i].day)}</text>
      ))}
      {order.map((st, k) => {
        const lo = k ? cum[last][k - 1] : 0, hi = cum[last][k];
        if (y(lo) - y(hi) < 9) return null;
        return (
          <text key={st.id} x={W - R + 6} y={(y(lo) + y(hi)) / 2 + 3.5} className={cn('text-[10px]', neck?.id === st.id ? 'fill-warn font-semibold' : 'fill-foreground')}>
            {st.label} <tspan className="tabular-nums">{format(hi - lo)}</tspan>
          </text>
        );
      })}
    </svg>
  );
}

/* -------------------------------------------------------------- Network */

export type NetNode = { id: string; label: string; tone?: Tone; weight?: number; detail?: string };
export type NetLink = { source: string; target: string; weight?: number };

/** A force layout computed once (deterministic: same input, same picture). */
function forceLayout(nodes: NetNode[], links: NetLink[], W: number, H: number) {
  const n = nodes.length;
  const idx = new Map(nodes.map((d, i) => [d.id, i]));
  const p = nodes.map((_, i) => ({ x: W / 2 + Math.cos((i / n) * 2 * Math.PI) * W * 0.3, y: H / 2 + Math.sin((i / n) * 2 * Math.PI) * H * 0.3 }));
  const E = links.map((l) => [idx.get(l.source), idx.get(l.target)]).filter((e): e is [number, number] => e[0] !== undefined && e[1] !== undefined);
  const k = Math.sqrt((W * H) / Math.max(1, n)) * 0.6;
  let temp = W / 8;
  for (let it = 0; it < 300; it++) {
    const d = p.map(() => ({ x: 0, y: 0 }));
    for (let i = 0; i < n; i++)
      for (let j = i + 1; j < n; j++) {
        let dx = p[i].x - p[j].x, dy = p[i].y - p[j].y;
        const dist = Math.max(0.01, Math.hypot(dx, dy));
        const f = (k * k) / dist;
        dx /= dist; dy /= dist;
        d[i].x += dx * f; d[i].y += dy * f; d[j].x -= dx * f; d[j].y -= dy * f;
      }
    for (const [a, b] of E) {
      let dx = p[a].x - p[b].x, dy = p[a].y - p[b].y;
      const dist = Math.max(0.01, Math.hypot(dx, dy));
      const f = (dist * dist) / k;
      dx /= dist; dy /= dist;
      d[a].x -= dx * f; d[a].y -= dy * f; d[b].x += dx * f; d[b].y += dy * f;
    }
    for (let i = 0; i < n; i++) {
      d[i].x += (W / 2 - p[i].x) * 0.05 * k / 10;
      d[i].y += (H / 2 - p[i].y) * 0.05 * k / 10;
      const len = Math.max(0.01, Math.hypot(d[i].x, d[i].y));
      p[i].x += (d[i].x / len) * Math.min(len, temp);
      p[i].y += (d[i].y / len) * Math.min(len, temp);
    }
    temp *= 0.98;
  }
  // Fit into the box.
  const padX = 70, padY = 24;
  const xs = p.map((q) => q.x), ys = p.map((q) => q.y);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  return p.map((q) => ({ x: padX + ((q.x - x0) / Math.max(1, x1 - x0)) * (W - 2 * padX), y: padY + ((q.y - y0) / Math.max(1, y1 - y0)) * (H - 2 * padY - 12) }));
}

/**
 * Who is connected to whom: a ring of shared devices, the systems a process
 * touches. Hovering a node keeps it and its neighbours and fades the rest.
 * Past about forty nodes or with dense links, a matrix reads better.
 */
export function Network({ nodes, links, focus, height = 300, onOpen, className }: { nodes: NetNode[]; links: NetLink[]; focus?: string | null; height?: number; onOpen?: (id: string) => void; className?: string }) {
  const [hover, setHover] = useState<string | null>(null);
  const drawn = useDrawn();
  const W = 640, H = height;
  const pos = useMemo(() => forceLayout(nodes, links, W, H), [nodes, links, H]);
  const idx = new Map(nodes.map((d, i) => [d.id, i]));
  const active = hover ?? focus ?? null;
  const near = new Set<string>(active ? [active, ...links.filter((l) => l.source === active || l.target === active).flatMap((l) => [l.source, l.target])] : []);
  const maxW = Math.max(1, ...nodes.map((d) => d.weight ?? 1));
  const maxL = Math.max(1, ...links.map((l) => l.weight ?? 1));
  const r = (d: NetNode) => 5 + Math.sqrt((d.weight ?? 1) / maxW) * 9;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={cn('viz-svg block h-auto w-full max-w-full', className)} role="img" aria-label="Who is connected to whom">
      {links.map((l, i) => {
        const a = idx.get(l.source), b = idx.get(l.target);
        if (a === undefined || b === undefined) return null;
        const on = !active || (near.has(l.source) && near.has(l.target) && (l.source === active || l.target === active));
        return <line key={i} x1={pos[a].x} y1={pos[a].y} x2={pos[b].x} y2={pos[b].y} className={cn(on && active ? 'stroke-foreground/60' : 'stroke-muted-foreground/40', 'transition-opacity duration-300')} strokeWidth={1 + ((l.weight ?? 1) / maxL) * 2.5} style={{ opacity: drawn ? (on ? 1 : 0.15) : 0 }} />;
      })}
      {nodes.map((d, i) => {
        const on = !active || near.has(d.id);
        return (
          <g key={d.id} className={cn('transition-opacity duration-300', onOpen && 'cursor-pointer')} style={{ opacity: on ? 1 : 0.2 }} onMouseEnter={() => setHover(d.id)} onMouseLeave={() => setHover(null)} onClick={() => onOpen?.(d.id)}>
            <circle cx={pos[i].x} cy={pos[i].y} r={r(d)} className={cn(FILL[d.tone ?? 'primary'], 'stroke-background viz-pop', drawn && 'is-drawn')} strokeWidth={2} style={{ transitionDelay: `${i * 25}ms` }} />
            <text x={pos[i].x} y={pos[i].y + r(d) + 11} textAnchor="middle" className={cn('text-[9.5px]', active === d.id ? 'fill-foreground font-semibold' : 'fill-foreground/80')} {...halo}>{ellipsis(d.label, 20)}</text>
            <title>{`${d.label}: ${links.filter((l) => l.source === d.id || l.target === d.id).length} links${d.detail ? `; ${d.detail}` : ''}`}</title>
          </g>
        );
      })}
    </svg>
  );
}
