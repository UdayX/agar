/**
 * Optics.
 *
 * The plate is drawn once into a low-resolution buffer — that resolution IS the
 * dither grid — quantised, then blown up with smoothing off. Overlay furniture
 * (dish rim, reticle, scale bar, brush cursor) is drawn afterwards at full
 * resolution so it stays hairline crisp against the chunky plate underneath.
 */
import { ditherImage, type RGB } from './dither';
import { DEAD, SENESCENT, SPORE, type Cell, type Sim } from './sim';
import type { Params } from './params';
import { speciesById } from './params';

export function hexToRGB(hex: string): RGB {
  const h = hex.replace('#', '');
  const n = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const v = parseInt(n, 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}

export interface Cursor { x: number; y: number; r: number; tool: string; on: boolean; }

export class Renderer {
  canvas: HTMLCanvasElement;
  cursor: Cursor = { x: 0, y: 0, r: 30, tool: 'inspect', on: false };
  private ctx: CanvasRenderingContext2D;
  private buf = document.createElement('canvas');
  private bctx: CanvasRenderingContext2D;
  private acc = document.createElement('canvas');
  private actx: CanvasRenderingContext2D;
  private grid = document.createElement('canvas');
  private gctx: CanvasRenderingContext2D;
  private mask: Uint8Array | null = null;
  private dens: Float32Array | null = null;
  private frame = 0;
  w = 0; h = 0; dpr = 1; bw = 0; bh = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false })!;
    this.bctx = this.buf.getContext('2d', { willReadFrequently: true, alpha: false })!;
    this.actx = this.acc.getContext('2d', { willReadFrequently: true, alpha: false })!;
    this.gctx = this.grid.getContext('2d', { willReadFrequently: true })!;
  }

  resize(w: number, h: number, pixelSize: number): void {
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.w = w; this.h = h;
    this.canvas.width = Math.round(w * this.dpr);
    this.canvas.height = Math.round(h * this.dpr);
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;
    this.bw = Math.max(1, Math.ceil(w / pixelSize));
    this.bh = Math.max(1, Math.ceil(h / pixelSize));
    if (this.buf.width !== this.bw || this.buf.height !== this.bh) {
      this.buf.width = this.bw; this.buf.height = this.bh;
      this.acc.width = this.bw; this.acc.height = this.bh;
      this.mask = new Uint8Array(this.bw * this.bh);
      this.bctx.fillStyle = '#fff';
      this.bctx.fillRect(0, 0, this.bw, this.bh);
    }
  }

  private accentValue(c: Cell, p: Params): number {
    switch (p.accent) {
      case 'energy': return c.mu;
      case 'age': return c.state === SENESCENT ? 1 : Math.min(1, c.age / Math.max(1, p.lifespan));
      case 'lineage': return (c.lineage % 7) / 6;
      case 'drug': return Math.min(1, c.g.resistance / 1.2);
      default: return 0;
    }
  }

  draw(sim: Sim, p: Params): void {
    this.frame++;
    const b = this.bctx;
    b.globalAlpha = 1;
    b.fillStyle = '#fff';
    b.fillRect(0, 0, this.bw, this.bh);

    if (p.view === 'plate') {
      b.imageSmoothingEnabled = true;
      b.drawImage(sim.raster.canvas, 0, 0, this.bw, this.bh);
      this.quantise(p, false);
      this.present(sim, p);
      return;
    }
    if (p.view !== 'culture') {
      this.heatmap(sim, p);
      this.present(sim, p);
      return;
    }

    // ── persistence: a long-exposure micrograph of a moving culture ──────
    if (p.persistence > 0) {
      b.globalAlpha = 1 - p.persistence;
      b.fillStyle = '#fff';
      b.fillRect(0, 0, this.bw, this.bh);
      b.globalAlpha = 1;
    }

    const s = 1 / p.pixelSize;
    const f = sim.field;
    if (this.grid.width !== f.cols || this.grid.height !== f.rows) {
      this.grid.width = f.cols; this.grid.height = f.rows;
    }
    const fimg = this.gctx.createImageData(f.cols, f.rows);
    const ref = Math.max(0.05, p.mode === 'dish' ? p.dishRichness : p.substrate);
    for (let i = 0, q = 0; i < f.s.length; i++, q += 4) {
      const v = Math.min(1, f.s[i] / ref);
      const g = 255 - v * 132;
      fimg.data[q] = g; fimg.data[q + 1] = g; fimg.data[q + 2] = g; fimg.data[q + 3] = 255;
    }
    this.gctx.putImageData(fimg, 0, 0);
    b.globalAlpha = p.persistence > 0 ? 0.5 : 1;
    b.imageSmoothingEnabled = true;
    b.drawImage(this.grid, 0, 0, this.bw, this.bh);
    b.globalAlpha = 1;

    // ── cells ────────────────────────────────────────────────────────────
    const sp = speciesById(p.species);
    const baseR = sp.radius * p.cellScale * 4 * s;
    const tilt = (p.tilt * Math.PI) / 180;
    const ct = Math.cos(tilt), cy = this.bh / 2;
    const list = sim.cells;
    if (p.depth > 0 && tilt > 0) list.sort((a, c) => a.z - c.z);

    const accentOn = p.accent !== 'none';
    // Acid is a scarce channel: it marks the top of the current distribution,
    // not an absolute value. When every cell is identical nothing is hot and the
    // plate stays greyscale, which is the honest reading.
    let accentFloor = Infinity;
    if (accentOn) {
      this.actx.fillStyle = '#fff';
      this.actx.fillRect(0, 0, this.bw, this.bh);
      const stride = Math.max(1, (list.length / 400) | 0);
      const vals: number[] = [];
      for (let i = 0; i < list.length; i += stride) {
        if (list[i].state !== DEAD) vals.push(this.accentValue(list[i], p));
      }
      if (vals.length > 4) {
        vals.sort((a, c) => a - c);
        accentFloor = Math.max(0.02, vals[Math.floor(vals.length * 0.85)]);
      }
    }

    for (const c of list) {
      const x = c.x * s;
      let y = c.y * s;
      if (tilt > 0) y = cy + (y - cy) * ct - c.z * 14 * p.depth * s;
      const depthScale = 1 + c.z * 0.22 * p.depth;
      const r = Math.max(0.35, baseR * Math.sqrt(Math.max(0.05, c.size)) * depthScale);
      const alpha = 1 - Math.max(0, 0.5 - c.z * 0.5) * 0.35 * p.depth;

      let tone: number;
      if (c.state === DEAD) tone = 0.68;
      else if (c.state === SPORE) tone = 0.3;
      else if (c.state === SENESCENT) tone = 0.42;
      else tone = 0.06 + (1 - c.mu) * 0.14;
      const g = Math.round(tone * 255);
      b.globalAlpha = c.state === DEAD ? Math.max(0, c.ghost) * 0.55 * alpha : alpha;
      b.fillStyle = b.strokeStyle = `rgb(${g},${g},${g})`;
      this.shapeOn(b, c, c.state === SPORE ? 'spore' : sp.shape, r, x, y);

      if (accentOn && c.state !== DEAD && this.accentValue(c, p) >= accentFloor) {
        this.actx.globalAlpha = 1;
        this.actx.fillStyle = this.actx.strokeStyle = '#000';
        this.shapeOn(this.actx, c, c.state === SPORE ? 'spore' : sp.shape, r, x, y);
      }
    }
    b.globalAlpha = 1;

    this.quantise(p, accentOn);
    this.present(sim, p);
  }

  /** Nutrient / toxin / density as a dithered field. Same pipeline, no cells. */
  private heatmap(sim: Sim, p: Params): void {
    const f = sim.field;
    if (this.grid.width !== f.cols || this.grid.height !== f.rows) {
      this.grid.width = f.cols; this.grid.height = f.rows;
    }
    let src: Float32Array;
    let ref: number;
    if (p.view === 'toxin') {
      src = sim.toxin.s;
      ref = Math.max(0.4, sim.drug + 1);
    } else if (p.view === 'density') {
      const n = f.cols * f.rows;
      if (!this.dens || this.dens.length !== n) this.dens = new Float32Array(n);
      this.dens.fill(0);
      for (const c of sim.cells) {
        if (c.state === DEAD) continue;
        const gx = (c.x / f.cell) | 0, gy = (c.y / f.cell) | 0;
        if (gx < 0 || gy < 0 || gx >= f.cols || gy >= f.rows) continue;
        this.dens[gy * f.cols + gx] += c.size;
      }
      src = this.dens; ref = 3;
    } else {
      src = f.s;
      ref = Math.max(0.05, p.mode === 'dish' ? p.dishRichness : p.substrate);
    }

    // Normalise to what is actually on the plate, not to a nominal maximum —
    // otherwise a full dish reads as one flat block of ink.
    let peak = 0;
    for (let i = 0; i < src.length; i++) if (src[i] > peak) peak = src[i];
    const norm = Math.max(peak, ref * 0.15, 1e-6);

    const img = this.gctx.createImageData(f.cols, f.rows);
    const hot = new Uint8Array(f.cols * f.rows);
    for (let i = 0, q = 0; i < src.length; i++, q += 4) {
      const v = Math.min(1, src[i] / norm);
      const g = Math.round(255 - v * 250);
      img.data[q] = g; img.data[q + 1] = g; img.data[q + 2] = g; img.data[q + 3] = 255;
      hot[i] = v > 0.88 ? 1 : 0;      // acid marks the richest pockets only
    }
    this.gctx.putImageData(img, 0, 0);
    this.bctx.imageSmoothingEnabled = true;
    this.bctx.drawImage(this.grid, 0, 0, this.bw, this.bh);

    const accentOn = p.accent !== 'none';
    if (accentOn && this.mask) {
      // Rebuild the accent mask at buffer resolution from the field's hot cells.
      this.actx.fillStyle = '#fff';
      this.actx.fillRect(0, 0, this.bw, this.bh);
      this.actx.fillStyle = '#000';
      const sx = this.bw / f.cols, sy = this.bh / f.rows;
      for (let gy = 0; gy < f.rows; gy++) {
        for (let gx = 0; gx < f.cols; gx++) {
          if (hot[gy * f.cols + gx]) this.actx.fillRect(gx * sx, gy * sy, Math.ceil(sx), Math.ceil(sy));
        }
      }
    }
    this.quantise(p, accentOn);
  }

  private shapeOn(b: CanvasRenderingContext2D, c: Cell, shape: string, r: number, x: number, y: number): void {
    const a = c.angle;
    const elong = Math.max(1, c.size);
    switch (shape) {
      case 'spore': {
        b.beginPath(); b.arc(x, y, r * 0.72, 0, 6.283); b.fill();
        const prev = b.fillStyle;
        b.fillStyle = '#fff';
        b.beginPath(); b.arc(x, y, r * 0.3, 0, 6.283); b.fill();
        b.fillStyle = prev;
        return;
      }
      case 'rod':
      case 'filament': {
        const L = r * (shape === 'filament' ? 2.6 : 1.5) * elong;
        b.lineWidth = r * 2; b.lineCap = 'round';
        b.beginPath();
        b.moveTo(x - Math.cos(a) * L * 0.5, y - Math.sin(a) * L * 0.5);
        b.lineTo(x + Math.cos(a) * L * 0.5, y + Math.sin(a) * L * 0.5);
        b.stroke();
        break;
      }
      case 'hypha': {
        const L = r * 4.5;
        b.lineWidth = r * 1.15; b.lineCap = 'round';
        b.beginPath();
        b.moveTo(x - Math.cos(a) * L, y - Math.sin(a) * L);
        b.lineTo(x, y);
        b.stroke();
        if (c.tip) { b.beginPath(); b.arc(x, y, r * 0.95, 0, 6.283); b.fill(); }
        break;
      }
      case 'spiral': {
        b.lineWidth = Math.max(0.6, r * 1.2); b.lineCap = 'round';
        b.beginPath();
        const L = r * 5 * elong, turns = 2.2;
        for (let i = 0; i <= 12; i++) {
          const u = i / 12;
          const px = (u - 0.5) * L;
          const py = Math.sin(u * turns * Math.PI * 2) * r * 1.1;
          const rx = x + px * Math.cos(a) - py * Math.sin(a);
          const ry = y + px * Math.sin(a) + py * Math.cos(a);
          i === 0 ? b.moveTo(rx, ry) : b.lineTo(rx, ry);
        }
        b.stroke();
        break;
      }
      case 'bud': {
        b.beginPath(); b.arc(x, y, r, 0, 6.283); b.fill();
        const budR = r * Math.min(0.8, Math.max(0, c.size - c.born) * 0.9);
        if (budR > 0.4) {
          b.beginPath();
          b.arc(x + Math.cos(a) * (r + budR * 0.7), y + Math.sin(a) * (r + budR * 0.7), budR, 0, 6.283);
          b.fill();
        }
        if (r > 2.2) {                                   // bud scars = replicative age
          const scars = Math.min(8, c.divisions);
          b.globalAlpha *= 0.55;
          for (let i = 0; i < scars; i++) {
            const sa = a + 2.4 + i * 1.9;
            b.beginPath();
            b.arc(x + Math.cos(sa) * r * 0.72, y + Math.sin(sa) * r * 0.72, Math.max(0.4, r * 0.16), 0, 6.283);
            b.fill();
          }
          b.globalAlpha /= 0.55;
        }
        break;
      }
      case 'amoeboid': {
        b.beginPath();
        for (let i = 0; i <= 14; i++) {
          const u = (i / 14) * Math.PI * 2;
          const wob = 1 + 0.28 * Math.sin(u * 3 + c.id * 0.7 + a * 2) + 0.12 * Math.sin(u * 5 - c.id);
          const px = x + Math.cos(u) * r * wob, py = y + Math.sin(u) * r * wob;
          i === 0 ? b.moveTo(px, py) : b.lineTo(px, py);
        }
        b.closePath(); b.fill();
        break;
      }
      default:
        b.beginPath(); b.arc(x, y, r, 0, 6.283); b.fill();
    }
    if ((shape === 'bud' || shape === 'amoeboid') && r > 2.4) {
      const prev = b.fillStyle;
      b.fillStyle = '#fff';
      b.globalAlpha *= 0.85;
      b.beginPath(); b.arc(x - r * 0.15, y - r * 0.15, r * 0.32, 0, 6.283); b.fill();
      b.globalAlpha /= 0.85;
      b.fillStyle = prev;
    }
  }

  private quantise(p: Params, accentOn: boolean): void {
    const img = this.bctx.getImageData(0, 0, this.bw, this.bh);
    let mask: Uint8Array | null = null;
    if (accentOn && this.mask) {
      const a = this.actx.getImageData(0, 0, this.bw, this.bh).data;
      mask = this.mask;
      for (let i = 0, q = 0; i < mask.length; i++, q += 4) mask[i] = a[q] < 128 ? 1 : 0;
    }
    ditherImage(img, mask, {
      kernel: p.dither, levels: p.levels, contrast: p.contrast, exposure: p.exposure,
      grain: p.grain, invert: p.invert,
      ink: hexToRGB(p.inkColor), paper: hexToRGB(p.paperColor), acid: hexToRGB(p.acidColor),
      frame: this.frame,
    });
    this.bctx.putImageData(img, 0, 0);
  }

  private present(sim: Sim, p: Params): void {
    const c = this.ctx;
    c.imageSmoothingEnabled = false;
    c.drawImage(this.buf, 0, 0, this.bw, this.bh, 0, 0, this.canvas.width, this.canvas.height);
    this.overlay(sim, p);
  }

  /** Dish rim, micrograph furniture, beacons and the brush cursor. */
  private overlay(sim: Sim, p: Params): void {
    const c = this.ctx;
    const d = this.dpr;
    const ink = p.invert ? hexToRGB(p.paperColor) : hexToRGB(p.inkColor);
    const acid = hexToRGB(p.acidColor);
    c.save();
    c.scale(d, d);
    const w = this.canvas.width / d, h = this.canvas.height / d;
    const inkC = `rgb(${ink[0]},${ink[1]},${ink[2]})`;
    const acidC = `rgb(${acid[0]},${acid[1]},${acid[2]})`;

    if (p.mode === 'dish') {
      c.strokeStyle = `rgba(${ink[0]},${ink[1]},${ink[2]},0.5)`;
      c.lineWidth = 1;
      c.beginPath(); c.arc(sim.dishCx, sim.dishCy, sim.dishR, 0, 6.283); c.stroke();
      c.strokeStyle = `rgba(${ink[0]},${ink[1]},${ink[2]},0.18)`;
      c.beginPath(); c.arc(sim.dishCx, sim.dishCy, sim.dishR - 6, 0, 6.283); c.stroke();
    }

    // light beacons
    for (const bn of sim.beacons) {
      c.strokeStyle = acidC; c.lineWidth = 2;
      c.beginPath(); c.arc(bn.x, bn.y, 9, 0, 6.283); c.stroke();
      c.strokeStyle = inkC; c.lineWidth = 1;
      c.beginPath();
      c.moveTo(bn.x - 14, bn.y); c.lineTo(bn.x + 14, bn.y);
      c.moveTo(bn.x, bn.y - 14); c.lineTo(bn.x, bn.y + 14);
      c.stroke();
    }

    // brush cursor
    const cur = this.cursor;
    if (cur.on && cur.tool !== 'inspect') {
      c.setLineDash([3, 3]);
      c.strokeStyle = cur.tool === 'toxin' || cur.tool === 'scrape' ? inkC : acidC;
      c.lineWidth = cur.tool === 'toxin' || cur.tool === 'scrape' ? 1 : 2;
      c.beginPath(); c.arc(cur.x, cur.y, cur.r, 0, 6.283); c.stroke();
      c.setLineDash([]);
      c.strokeStyle = inkC; c.lineWidth = 1;
      c.beginPath(); c.arc(cur.x, cur.y, 1.5, 0, 6.283); c.stroke();
    }

    if (!p.overlay) { c.restore(); return; }

    c.strokeStyle = `rgba(${ink[0]},${ink[1]},${ink[2]},0.55)`;
    c.fillStyle = inkC;
    c.lineWidth = 1;
    const m = 14, t = 9;
    for (const [x, y, sx, sy] of [[m, m, 1, 1], [w - m, m, -1, 1], [m, h - m, 1, -1], [w - m, h - m, -1, -1]] as const) {
      c.beginPath();
      c.moveTo(x + sx * t + 0.5, y + 0.5); c.lineTo(x + 0.5, y + 0.5); c.lineTo(x + 0.5, y + sy * t + 0.5);
      c.stroke();
    }

    const pxPerUm = 4 * p.cellScale;
    let bar = 50;
    while (bar * pxPerUm > w * 0.3) bar /= 2;
    while (bar * pxPerUm < w * 0.08) bar *= 2;
    const bx = m + 2, by = h - m - 12;
    c.strokeStyle = inkC; c.lineWidth = 2;
    c.beginPath(); c.moveTo(bx, by); c.lineTo(bx + bar * pxPerUm, by); c.stroke();
    c.lineWidth = 1;
    c.beginPath();
    c.moveTo(bx, by - 3); c.lineTo(bx, by + 3);
    c.moveTo(bx + bar * pxPerUm, by - 3); c.lineTo(bx + bar * pxPerUm, by + 3);
    c.stroke();

    c.font = '500 9px ui-monospace, SFMono-Regular, Menlo, monospace';
    (c as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = '0.06em';
    c.fillText(`${bar >= 1 ? bar : bar.toFixed(1)} µm`, bx, by + 12);

    const sp = speciesById(p.species);
    const slug = p.mode === 'dish' ? 'PETRI DISH' : `SPECIMEN · ${p.text.replace(/\n/g, ' ').slice(0, 24).toUpperCase()}`;
    c.fillText(slug, m + 2, m + 12);
    c.fillText(`${sp.label.toUpperCase()} · ${sp.kingdom.toUpperCase()}`, m + 2, m + 24);
    const right = (s: string, y: number) => c.fillText(s, w - m - 2 - c.measureText(s).width, y);
    right(`T+${(sim.t / 60).toFixed(1)} H`, m + 12);
    right(`N=${sim.cells.filter((x) => x.state !== DEAD).length}`, m + 24);
    right(sim.phase.toUpperCase(), h - m - 2);
    c.restore();
  }
}
