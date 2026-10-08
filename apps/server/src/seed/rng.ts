/** Deterministic RNG (mulberry32) so a reset reproduces the same world. */
export class Rng {
  private s: number;
  constructor(seed: number) { this.s = seed >>> 0; }
  next(): number { this.s = (this.s + 0x6d2b79f5) >>> 0; let t = this.s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }
  int(min: number, max: number): number { return min + Math.floor(this.next() * (max - min + 1)); }
  pick<T>(xs: T[]): T { return xs[Math.floor(this.next() * xs.length)]; }
  chance(p: number): boolean { return this.next() < p; }
  weighted<T>(xs: { v: T; w: number }[]): T { const total = xs.reduce((s, x) => s + x.w, 0); let r = this.next() * total; for (const x of xs) { r -= x.w; if (r <= 0) return x.v; } return xs[xs.length - 1].v; }
  shuffle<T>(xs: T[]): T[] { const a = [...xs]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(this.next() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  round(n: number, step: number) { return Math.round(n / step) * step; }
}
