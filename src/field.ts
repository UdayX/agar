/**
 * The medium: a scalar substrate field on a coarse grid.
 *
 * Reaction–diffusion in the Turing (1952) sense — diffusion plus local
 * consumption. Cells draw from it with Monod kinetics and return part of their
 * biomass when they lyse, which is what makes death phases stutter instead of
 * collapsing cleanly.
 */
export class Field {
  cols: number;
  rows: number;
  cell: number;
  s: Float32Array;      // substrate
  private tmp: Float32Array;

  constructor(cols: number, rows: number, cell: number) {
    this.cols = cols; this.rows = rows; this.cell = cell;
    this.s = new Float32Array(cols * rows);
    this.tmp = new Float32Array(cols * rows);
  }

  seed(coverage: Float32Array, amount: number, floor = 0.02): void {
    for (let i = 0; i < this.s.length; i++) this.s[i] = coverage[i] * amount + floor;
  }

  at(x: number, y: number): number {
    const gx = (x / this.cell) | 0, gy = (y / this.cell) | 0;
    if (gx < 0 || gy < 0 || gx >= this.cols || gy >= this.rows) return 0;
    return this.s[gy * this.cols + gx];
  }

  add(x: number, y: number, amount: number): void {
    const gx = (x / this.cell) | 0, gy = (y / this.cell) | 0;
    if (gx < 0 || gy < 0 || gx >= this.cols || gy >= this.rows) return;
    const i = gy * this.cols + gx;
    this.s[i] = Math.max(0, this.s[i] + amount);
  }

  /**
   * Explicit 5-point Laplacian with Neumann (no-flux) edges — the plate has
   * walls. Sub-stepped so the scheme stays stable at high time scales.
   */
  step(diffusion: number, dt: number, inflow: number): void {
    const total = diffusion * dt;
    if (total > 0) {
      const sub = Math.min(6, Math.max(1, Math.ceil(total / 0.2)));
      const a = Math.min(0.24, total / sub);
      const { cols, rows, s, tmp } = this;
      for (let k = 0; k < sub; k++) {
        for (let y = 0; y < rows; y++) {
          const up = y > 0 ? -cols : 0, dn = y < rows - 1 ? cols : 0;
          for (let x = 0; x < cols; x++) {
            const i = y * cols + x;
            const lf = x > 0 ? -1 : 0, rt = x < cols - 1 ? 1 : 0;
            tmp[i] = s[i] + a * (s[i + up] + s[i + dn] + s[i + lf] + s[i + rt] - 4 * s[i]);
          }
        }
        s.set(tmp);
      }
    }
    if (inflow > 0) {
      const g = inflow * dt;
      for (let i = 0; i < this.s.length; i++) this.s[i] += g * (1 - this.s[i]);
    }
  }

  totalSubstrate(): number {
    let t = 0;
    for (let i = 0; i < this.s.length; i++) t += this.s[i];
    return t;
  }
}
