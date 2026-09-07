/** Deterministic PRNG — mulberry32. Same seed, same culture, every time. */
export class RNG {
  private s: number;
  constructor(seed: number) { this.s = seed >>> 0; }
  next(): number {
    this.s = (this.s + 0x6d2b79f5) >>> 0;
    let t = this.s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  range(a: number, b: number): number { return a + (b - a) * this.next(); }
  int(n: number): number { return Math.floor(this.next() * n); }
  /** Box–Muller, one value per call. */
  normal(): number {
    const u = Math.max(1e-9, this.next());
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * this.next());
  }
  /** Lognormal multiplier, mean 1 — the shape mutation actually takes. */
  jitter(sigma: number): number {
    return sigma <= 0 ? 1 : Math.exp(this.normal() * sigma - (sigma * sigma) / 2);
  }
}
