/**
 * The culture.
 *
 * Agent-based, off-lattice. Each cell carries a small heritable genome that is
 * perturbed at every division, so selection is emergent rather than scripted:
 * nothing here tells the population to get faster, it just does when faster
 * cells leave more descendants.
 *
 * Clocks: motion integrates real seconds (run-and-tumble statistics are only
 * meaningful there); metabolism, ageing and division integrate simulated
 * minutes at `timeScale` min/s.
 */
import { Field } from './field';
import type { Params, Species } from './params';
import { speciesById } from './params';
import { rasterize, FIELD_CELL, type Raster } from './glyph';
import { RNG } from './rng';

export const ALIVE = 0, SENESCENT = 1, DEAD = 2, SPORE = 3;

/** Field-concentration drop per unit of biomass built. */
const SUBSTRATE_COST = 0.35;
/** Light falls off as a Gaussian with this radius, in pixels. */
const BEACON_SIGMA = 130;
/**
 * µm/s → px/s. Real swim speeds relative to real cell sizes are far too fast to
 * read on a screen this size, so motion carries a legibility scale. Everything
 * else (run lengths, tumble angles, growth) stays at its published value.
 */
const SWIM_SCALE = 0.9;

export interface Genome {
  mu: number; ks: number; speed: number;
  adhesion: number; resistance: number; adder: number;
}

export interface Cell {
  id: number; lineage: number; gen: number;
  x: number; y: number; z: number;
  vx: number; vy: number; angle: number;
  size: number; born: number;
  age: number; divisions: number;
  state: number; ghost: number;
  mu: number;
  runTimer: number; lastS: number;
  organelles: number; tip: boolean; starving: number;
  g: Genome;
}

export interface Beacon { x: number; y: number; }
export type Phase = 'lag' | 'log' | 'stationary' | 'death' | 'extinct';
export interface Sample { t: number; pop: number; sub: number; mu: number; speed: number; res: number; }
export interface LogLine { t: number; kind: string; text: string; }

/**
 * Ratkowsky square-root response around each organism's own optimum, so a
 * thermophile and a mesophile do not share one curve.
 */
function tempFactor(T: number, topt: number, tmax: number): number {
  const tmin = topt - 33;
  if (T <= tmin || T >= tmax) return 0;
  const r = (T - tmin) * (1 - Math.exp(0.3 * (T - tmax)));
  const ref = (topt - tmin) * (1 - Math.exp(0.3 * (topt - tmax)));
  return ref <= 0 ? 0 : (r / ref) ** 2;
}

export class Sim {
  w = 0; h = 0;
  dishR = 0; dishCx = 0; dishCy = 0;
  cells: Cell[] = [];
  field!: Field;          // substrate
  toxin!: Field;          // drug, spatial — brushed on as well as dosed in bulk
  raster!: Raster;
  rng!: RNG;
  beacons: Beacon[] = [];
  t = 0;
  phase: Phase = 'lag';
  drug = 0;               // bulk baseline
  samples: Sample[] = [];
  log: LogLine[] = [];
  milestones = new Set<string>();
  peakPop = 0; totalBorn = 0; totalDied = 0; spores = 0;
  private nextId = 1;
  private sampleAt = 0;
  private pending: Phase = 'lag';
  private pendingSince = 0;
  private head!: Int32Array;
  private next!: Int32Array;
  private hashCell = 8;
  private hcols = 0; private hrows = 0;
  private sp!: Species;
  private p!: Params;

  reset(w: number, h: number, p: Params): void {
    this.w = w; this.h = h; this.p = p;
    this.sp = speciesById(p.species);
    this.rng = new RNG(p.seed);
    this.raster = rasterize(w, h, p);
    this.dishCx = w / 2; this.dishCy = h / 2;
    this.dishR = Math.min(w, h) / 2 - 8;
    this.field = new Field(this.raster.cols, this.raster.rows, FIELD_CELL);
    if (p.mode === 'dish') this.pourDish(p);
    else this.field.seed(this.raster.coverage, p.substrate, 0.015);
    this.toxin = new Field(this.raster.cols, this.raster.rows, FIELD_CELL);
    this.cells = []; this.beacons = [];
    this.t = 0; this.drug = p.drugDose; this.phase = 'lag';
    this.pending = 'lag'; this.pendingSince = 0;
    this.samples = []; this.log = []; this.milestones.clear();
    this.peakPop = 0; this.totalBorn = 0; this.totalDied = 0; this.spores = 0;
    this.nextId = 1; this.sampleAt = 0;
    this.inoculate(p);
    this.note('seed', `inoculated ${this.cells.length} cells · ${this.sp.label}`);
  }

  /** An even pour of agar inside the dish, nothing outside it. */
  private pourDish(p: Params): void {
    const f = this.field;
    for (let gy = 0; gy < f.rows; gy++) {
      for (let gx = 0; gx < f.cols; gx++) {
        const x = (gx + 0.5) * FIELD_CELL - this.dishCx;
        const y = (gy + 0.5) * FIELD_CELL - this.dishCy;
        f.s[gy * f.cols + gx] = x * x + y * y < this.dishR * this.dishR ? p.dishRichness : 0;
      }
    }
  }

  private note(kind: string, text: string): void {
    this.log.push({ t: this.t, kind, text });
    if (this.log.length > 300) this.log.shift();
  }

  private achieve(id: string, text: string): void {
    if (this.milestones.has(id)) return;
    this.milestones.add(id);
    this.note('milestone', text);
  }

  private baseRadius(): number { return this.sp.radius * this.p.cellScale * 4; }

  /** Light from all beacons at a point, as an extra substrate for phototrophs. */
  lightAt(x: number, y: number): number {
    if (!this.beacons.length) return 0;
    let l = 0;
    for (const b of this.beacons) {
      const dx = x - b.x, dy = y - b.y;
      l += Math.exp(-(dx * dx + dy * dy) / (2 * BEACON_SIGMA * BEACON_SIGMA));
    }
    return l * this.p.light;
  }

  private makeCell(x: number, y: number, lineage: number): Cell {
    const r = this.rng;
    return {
      id: this.nextId++, lineage, gen: 0,
      x, y, z: r.range(-1, 1),
      vx: 0, vy: 0, angle: r.range(0, Math.PI * 2),
      size: r.range(0.7, 1.2), born: 0,
      age: r.range(0, 20), divisions: 0,
      state: ALIVE, ghost: 0, mu: 0,
      runTimer: r.range(0, 1), lastS: 0,
      organelles: 0, tip: true, starving: 0,
      g: {
        mu: r.jitter(0.08), ks: r.jitter(0.08), speed: r.jitter(0.1),
        adhesion: r.jitter(0.1), resistance: Math.max(0, r.normal() * 0.06 + 0.05),
        adder: r.jitter(0.06),
      },
    };
  }

  private inoculate(p: Params): void {
    const r = this.rng;
    const { sites } = this.raster;
    const n = sites.length / 2;
    const push = (x: number, y: number) => {
      const c = this.makeCell(x, y, this.cells.length);
      c.born = c.size - p.adderIncrement * 0.5;
      this.cells.push(c);
    };

    if (p.mode === 'dish') {
      const n = Math.max(1, Math.round(p.colonies));
      for (let k = 0; k < n; k++) {
        const a = r.range(0, Math.PI * 2), d = Math.sqrt(r.next()) * this.dishR * 0.72;
        const cx = this.dishCx + Math.cos(a) * d, cy = this.dishCy + Math.sin(a) * d;
        const per = 6 + Math.round(30 * p.seedDensity);
        for (let i = 0; i < per; i++) {
          const b = r.range(0, Math.PI * 2), e = Math.sqrt(r.next()) * 9;
          push(cx + Math.cos(b) * e, cy + Math.sin(b) * e);
        }
      }
      if (this.cells.length > p.capacity) this.cells.length = p.capacity;
      this.totalBorn = this.cells.length;
      return;
    }

    if (p.inoculum === 'glyph') {
      // Random subsample, not every nth site — stepping a row-major list lays
      // the inoculum down in stripes.
      for (let i = 0; i < n; i++) {
        if (r.next() < p.seedDensity) push(sites[i * 2] + r.range(-1, 1), sites[i * 2 + 1] + r.range(-1, 1));
      }
    } else if (p.inoculum === 'edge') {
      const count = Math.round(40 + 360 * p.seedDensity);
      for (let i = 0; i < count; i++) {
        const side = r.int(4), m = 6;
        const x = side === 0 ? m : side === 1 ? this.w - m : r.range(m, this.w - m);
        const y = side === 2 ? m : side === 3 ? this.h - m : r.range(m, this.h - m);
        push(x, y);
      }
    } else if (p.inoculum === 'centre') {
      const count = Math.round(4 + 60 * p.seedDensity);
      for (let i = 0; i < count; i++) {
        const a = r.range(0, Math.PI * 2), d = r.range(0, 12);
        push(this.w / 2 + Math.cos(a) * d, this.h / 2 + Math.sin(a) * d);
      }
    } else {
      const count = Math.round(20 + 900 * p.seedDensity);
      for (let i = 0; i < count; i++) push(r.range(0, this.w), r.range(0, this.h));
    }
    if (this.cells.length > p.capacity) this.cells.length = p.capacity;
    this.totalBorn = this.cells.length;
  }

  // ── direct manipulation of the plate ───────────────────────────────────
  /** Brush the plate. This is the whole point of the tools: the medium is editable. */
  paint(x: number, y: number, radius: number, kind: string, p: Params): void {
    const r2 = radius * radius;
    if (kind === 'feed' || kind === 'toxin') {
      const f = kind === 'feed' ? this.field : this.toxin;
      const g0x = Math.max(0, ((x - radius) / FIELD_CELL) | 0);
      const g1x = Math.min(f.cols - 1, ((x + radius) / FIELD_CELL) | 0);
      const g0y = Math.max(0, ((y - radius) / FIELD_CELL) | 0);
      const g1y = Math.min(f.rows - 1, ((y + radius) / FIELD_CELL) | 0);
      for (let gy = g0y; gy <= g1y; gy++) {
        for (let gx = g0x; gx <= g1x; gx++) {
          const dx = (gx + 0.5) * FIELD_CELL - x, dy = (gy + 0.5) * FIELD_CELL - y;
          const d2 = dx * dx + dy * dy;
          if (d2 > r2) continue;
          const fall = 1 - d2 / r2;
          const i = gy * f.cols + gx;
          f.s[i] = Math.min(kind === 'feed' ? p.substrate * 2.5 : 4, f.s[i] + fall * 0.5);
        }
      }
      return;
    }
    if (kind === 'scrape') {
      let removed = 0;
      this.cells = this.cells.filter((c) => {
        const dx = c.x - x, dy = c.y - y;
        if (dx * dx + dy * dy < r2) { removed++; return false; }
        return true;
      });
      if (removed) this.note('tool', `scraped ${removed} cells off the plate`);
      return;
    }
    if (kind === 'inoculate') {
      const r = this.rng;
      const want = Math.max(1, Math.round(radius * radius * 0.004));
      for (let i = 0; i < want && this.cells.length < p.capacity; i++) {
        const a = r.range(0, Math.PI * 2), d = Math.sqrt(r.next()) * radius;
        const c = this.makeCell(x + Math.cos(a) * d, y + Math.sin(a) * d, this.cells.length);
        c.born = c.size - p.adderIncrement * 0.5;
        this.cells.push(c);
        this.totalBorn++;
      }
    }
  }

  placeBeacon(x: number, y: number): void {
    this.beacons.push({ x, y });
    if (this.beacons.length > 6) this.beacons.shift();
    this.note('tool', `light beacon placed · ${this.beacons.length} on the plate`);
  }

  clearBeacons(): void { this.beacons = []; }

  // ── spatial hash ───────────────────────────────────────────────────────
  private buildHash(): void {
    const cell = Math.max(6, this.baseRadius() * 4);
    this.hashCell = cell;
    this.hcols = Math.ceil(this.w / cell) + 1;
    this.hrows = Math.ceil(this.h / cell) + 1;
    const n = this.hcols * this.hrows;
    if (!this.head || this.head.length !== n) this.head = new Int32Array(n);
    this.head.fill(-1);
    if (!this.next || this.next.length < this.cells.length) this.next = new Int32Array(this.cells.length + 512);
    for (let i = 0; i < this.cells.length; i++) {
      const c = this.cells[i];
      const gx = Math.min(this.hcols - 1, Math.max(0, (c.x / cell) | 0));
      const gy = Math.min(this.hrows - 1, Math.max(0, (c.y / cell) | 0));
      const k = gy * this.hcols + gx;
      this.next[i] = this.head[k];
      this.head[k] = i;
    }
  }

  private forEachNeighbour(c: Cell, fn: (o: Cell) => void): void {
    const cell = this.hashCell;
    const gx = Math.min(this.hcols - 1, Math.max(0, (c.x / cell) | 0));
    const gy = Math.min(this.hrows - 1, Math.max(0, (c.y / cell) | 0));
    for (let dy = -1; dy <= 1; dy++) {
      const yy = gy + dy;
      if (yy < 0 || yy >= this.hrows) continue;
      for (let dx = -1; dx <= 1; dx++) {
        const xx = gx + dx;
        if (xx < 0 || xx >= this.hcols) continue;
        let i = this.head[yy * this.hcols + xx];
        while (i !== -1) { const o = this.cells[i]; if (o !== c) fn(o); i = this.next[i]; }
      }
    }
  }

  // ── main step ──────────────────────────────────────────────────────────
  step(dtReal: number, p: Params): void {
    this.p = p;
    this.sp = speciesById(p.species);
    const dtBio = dtReal * p.timeScale;
    this.t += dtBio;

    const r = this.rng;
    const muMax = (Math.LN2 / Math.max(1, p.doubling)) * tempFactor(p.temperature, this.sp.topt, this.sp.tmax);
    const baseR = this.baseRadius();
    const isHypha = this.sp.shape === 'hypha';
    const isPhago = this.sp.phagotroph;
    const canSpore = this.sp.sporulates && p.sporulation > 0;
    const isPhoto = this.sp.phototroph;
    // Ben-Jacob 1994: agar hardness suppresses swimming and slows the medium,
    // which is what turns a smooth swarm into a branched, diffusion-limited colony.
    const dish = p.mode === 'dish';
    const hard = dish ? p.agar : 0;
    const motility = p.motility * (1 - 0.85 * hard);
    const diffusion = p.diffusion * (1 - 0.7 * hard);

    this.drug = Math.max(0, this.drug + (p.drugDose - this.drug) * 0.06 - this.drug * p.drugDecay * dtBio);

    this.buildHash();

    const births: Cell[] = [];
    let sumMu = 0, sumSpeed = 0, sumRes = 0, live = 0, veg = 0, quorumCount = 0, spores = 0;

    for (let i = 0; i < this.cells.length; i++) {
      const c = this.cells[i];

      if (c.state === DEAD) { c.ghost -= dtBio * 0.02; continue; }

      const S = this.field.at(c.x, c.y);
      const tox = this.drug + this.toxin.at(c.x, c.y);
      const lit = isPhoto ? this.lightAt(c.x, c.y) : 0;

      // ── dormancy ─────────────────────────────────────────────────────
      if (c.state === SPORE) {
        spores++; live++;
        c.age += dtBio * 0.02;                       // a spore ages slowly and ignores the drug
        if (S + lit > Math.max(0.08, p.ks * 3)) {
          c.state = ALIVE; c.size = Math.max(c.size, 0.75); c.born = c.size - p.adderIncrement * 0.5;
          c.starving = 0;
          this.achieve('germination', 'germination — dormant spores woke when food returned');
        }
        continue;
      }

      // ── metabolism (Monod 1949) ──────────────────────────────────────
      const ks = Math.max(0.005, p.ks * c.g.ks);
      const avail = S + lit;
      const mu = muMax * c.g.mu * (avail / (ks + avail));
      c.mu = muMax > 0 ? mu / muMax : 0;

      // Substrate is a concentration; SUBSTRATE_COST converts one unit of new
      // biomass into the drop it causes locally. Growth is clipped to what is
      // actually there, which is what makes a colony edge outrun its interior.
      const grow = mu * c.size * dtBio;
      const fromLight = avail > 0 ? lit / avail : 0;
      const need = (grow * (1 - fromLight)) / Math.max(0.05, p.yieldCoef);
      const cost = need * SUBSTRATE_COST;
      const ration = cost > S ? S / Math.max(1e-9, cost) : 1;
      const gained = grow * (fromLight + (1 - fromLight) * ration);
      if (cost > 0) this.field.add(c.x, c.y, -cost * ration);
      const upkeep = p.maintenance * c.size * dtBio * (c.state === SENESCENT ? 1.6 : 1) * (1 + c.organelles * 0.05);
      c.size += gained - upkeep;
      c.age += dtBio;
      c.starving = gained < upkeep ? c.starving + dtBio : 0;

      // ── sporulation: famine is survivable if you can go dormant ──────
      if (canSpore && c.starving > 30 && c.state === ALIVE && r.next() < p.sporulation * 0.03 * dtBio) {
        c.state = SPORE; c.size = Math.max(0.5, c.size * 0.7); c.vx = c.vy = 0;
        this.achieve('spores', 'sporulation — starving cells went dormant instead of lysing');
        spores++; live++;
        continue;
      }

      // ── death ────────────────────────────────────────────────────────
      let dead = '';
      if (c.size < 0.3) dead = 'starvation';
      else if (c.age > p.lifespan) dead = 'chronological';
      else if (tox > c.g.resistance && r.next() < (tox - c.g.resistance) * 0.06 * dtBio) dead = 'antibiotic';
      if (dead) { this.kill(c, dead, p); continue; }

      // ── senescence (Hayflick 1961; Mortimer & Johnston 1959) ─────────
      if (p.hayflick > 0 && c.divisions >= p.hayflick && c.state === ALIVE) {
        c.state = SENESCENT;
        this.achieve('senescence', `senescence — cell #${c.id} hit its replicative limit at ${c.divisions} divisions`);
      }

      // ── division: the adder rule (Taheri-Araghi 2015) ────────────────
      if (c.state === ALIVE && (!isHypha || c.tip) &&
          this.cells.length + births.length < p.capacity &&
          c.size - c.born >= p.adderIncrement * c.g.adder) {
        births.push(this.divide(c, p, isHypha));
        if (!this.milestones.has('first-division')) this.achieve('first-division', 'first division — the inoculum is growing');
      }

      // ── contact: repulsion, adhesion, alignment, transfer, predation ──
      let neighbours = 0, ax = 0, ay = 0, fx = 0, fy = 0;
      const rad = baseR * this.sizeR(c);
      this.forEachNeighbour(c, (o) => {
        if (o.state === DEAD) return;
        const dx = o.x - c.x, dy = o.y - c.y;
        const d2 = dx * dx + dy * dy;
        const rr = rad + baseR * this.sizeR(o);
        if (d2 > rr * rr * 4 || d2 < 1e-9) return;
        const d = Math.sqrt(d2);
        neighbours++;
        if (d < rr) {
          const push = (rr - d) / rr;
          fx -= (dx / d) * push * 26; fy -= (dy / d) * push * 26;
          const ad = p.adhesion * c.g.adhesion;
          fx += (dx / d) * ad * 6; fy += (dy / d) * ad * 6;
          if (p.hgt > 0 && r.next() < p.hgt * dtBio * 0.1) {
            c.g.resistance += (o.g.resistance - c.g.resistance) * 0.5;
          }
          if (isPhago && o.state !== DEAD && baseR * this.sizeR(o) < rad * 0.55 && r.next() < 0.5 * dtBio) {
            c.size += o.size * 0.6;
            if (r.next() < 0.04 && c.organelles < 3) {
              c.organelles++; c.g.mu *= 1.08;
              this.achieve('endosymbiosis', `endosymbiosis — cell #${c.id} kept an engulfed prokaryote as an organelle`);
            }
            this.kill(o, 'engulfed', p, false);
          }
        } else if (p.alignment > 0) {
          ax += Math.cos(o.angle); ay += Math.sin(o.angle);
        }
      });

      // quorum sensing (Miller & Bassler 2001)
      const quorum = neighbours > 7 ? 1 : 0;
      if (quorum) quorumCount++;

      // ── motility: run-and-tumble (Berg & Brown 1972) ─────────────────
      const speed = this.sp.speed * motility * c.g.speed * (quorum ? 0.35 : 1) * (isHypha && !c.tip ? 0 : 1);
      if (speed > 0.01) {
        // One sensed quantity: food and light attract, toxin repels, and all of
        // it acts through the same tumble bias. No cell ever steers.
        const sense = avail - p.repulsion * tox;
        const dS = (sense - c.lastS) / Math.max(1e-4, dtReal);
        c.runTimer -= dtReal;
        const bias = Math.exp(-p.chemotaxis * dS * 90);
        const meanRun = Math.max(0.05, p.runLength * this.sp.runLength / Math.max(0.05, bias));
        if (c.runTimer <= 0) {
          c.angle += (r.normal() * (p.tumbleAngle * Math.PI / 180)) * (isHypha ? 0.15 : 1);
          c.runTimer = -Math.log(Math.max(1e-6, r.next())) * meanRun;
        }
        if (p.alignment > 0 && (ax || ay)) {
          const target = Math.atan2(ay, ax);
          const da = ((target - c.angle + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
          c.angle += da * p.alignment * this.sp.alignment * Math.min(1, dtReal * 6);
        }
        // Propulsion relaxes velocity toward the swim speed rather than adding
        // thrust every frame — otherwise drag never balances it.
        const v = speed * SWIM_SCALE;
        const k = Math.min(1, dtReal * 8);
        c.vx += (Math.cos(c.angle) * v - c.vx) * k;
        c.vy += (Math.sin(c.angle) * v - c.vy) * k;
        c.lastS = sense;
      } else {
        c.lastS = avail - p.repulsion * tox;
      }

      // ── integrate ────────────────────────────────────────────────────
      if (isHypha && !c.tip) {                         // laid trunk: masonry, not a particle
        c.vx = 0; c.vy = 0;
        live++; veg++; sumMu += c.mu; sumSpeed += c.g.speed; sumRes += c.g.resistance;
        continue;
      }
      c.vx += fx * dtReal + p.shear * 0.3 * dtReal;
      c.vy += fy * dtReal;
      const damp = Math.exp(-dtReal * 7);
      c.vx *= damp; c.vy *= damp;
      c.x += c.vx * dtReal; c.y += c.vy * dtReal;
      c.z += (r.next() - 0.5) * dtReal * 0.4;
      if (c.z < -1) c.z = -1; if (c.z > 1) c.z = 1;

      const m = rad;
      if (dish) {                                      // round wall
        const dx = c.x - this.dishCx, dy = c.y - this.dishCy;
        const d = Math.hypot(dx, dy), lim = this.dishR - m;
        if (d > lim && d > 0) {
          c.x = this.dishCx + (dx / d) * lim;
          c.y = this.dishCy + (dy / d) * lim;
          const vn = (c.vx * dx + c.vy * dy) / d;
          if (vn > 0) { c.vx -= (dx / d) * vn * 1.4; c.vy -= (dy / d) * vn * 1.4; }
        }
      } else {
        if (c.x < m) { c.x = m; c.vx = Math.abs(c.vx) * 0.4; }
        if (c.x > this.w - m) { c.x = this.w - m; c.vx = -Math.abs(c.vx) * 0.4; }
        if (c.y < m) { c.y = m; c.vy = Math.abs(c.vy) * 0.4; }
        if (c.y > this.h - m) { c.y = this.h - m; c.vy = -Math.abs(c.vy) * 0.4; }
      }

      live++; veg++; sumMu += c.mu; sumSpeed += c.g.speed; sumRes += c.g.resistance;
    }

    for (const b of births) this.cells.push(b);
    this.totalBorn += births.length;
    this.spores = spores;

    let w = 0;
    for (let i = 0; i < this.cells.length; i++) {
      const c = this.cells[i];
      if (c.state === DEAD && c.ghost <= 0) continue;
      this.cells[w++] = c;
    }
    this.cells.length = w;

    this.field.step(diffusion, dtBio, p.replenish);
    this.toxin.step(Math.max(diffusion, 0.05), dtBio, 0);
    if (p.drugDecay > 0) {
      const keep = Math.max(0, 1 - p.drugDecay * dtBio);
      for (let i = 0; i < this.toxin.s.length; i++) this.toxin.s[i] *= keep;
    }

    this.peakPop = Math.max(this.peakPop, veg);
    if (veg > 0 && quorumCount > veg * 0.33) this.achieve('biofilm', 'biofilm — a third of the population crossed the quorum threshold');
    if (veg >= p.capacity * 0.98) this.achieve('capacity', 'carrying capacity — the plate is full');
    if (this.t > 1440) this.achieve('day', 'one culture day survived');
    this.sampleAndClassify(veg, sumMu, sumSpeed, sumRes);
  }

  private sizeR(c: Cell): number { return Math.sqrt(Math.max(0.05, c.size)); }

  private kill(c: Cell, cause: string, p: Params, lyse = true): void {
    if (c.state === DEAD) return;
    c.state = DEAD; c.ghost = 1; c.vx *= 0.2; c.vy *= 0.2;
    this.totalDied++;
    if (lyse && p.lysisReturn > 0) this.field.add(c.x, c.y, c.size * p.lysisReturn * SUBSTRATE_COST);
    if (cause === 'antibiotic' && this.rng.next() < 0.004) this.note('drug', `lysis by antibiotic · MIC ${c.g.resistance.toFixed(2)}`);
  }

  private divide(c: Cell, p: Params, isHypha: boolean): Cell {
    const r = this.rng;
    const keep = 0.5 + 0.5 * p.asymmetry;
    const total = c.size;
    const rad = this.baseRadius() * this.sizeR(c);

    const d: Cell = {
      ...c,
      id: this.nextId++, gen: c.gen + 1,
      size: total * (1 - keep), born: 0,
      age: 0, divisions: 0, state: ALIVE, ghost: 0, starving: 0,
      runTimer: r.range(0, 0.5), organelles: c.organelles, tip: true,
      g: {
        mu: c.g.mu * r.jitter(p.mutationRate),
        ks: c.g.ks * r.jitter(p.mutationRate),
        speed: c.g.speed * r.jitter(p.mutationRate),
        adhesion: c.g.adhesion * r.jitter(p.mutationRate),
        resistance: Math.max(0, c.g.resistance * r.jitter(p.mutationRate * 3) + r.normal() * p.mutationRate * 0.2),
        adder: c.g.adder * r.jitter(p.mutationRate * 0.5),
      },
    };
    d.born = d.size;

    // Fission splits along the long axis, budding puts the daughter on the
    // flank, a hypha extends from the apex and the trunk behind stops growing.
    const branch = isHypha && r.next() < 0.06 ? (r.next() < 0.5 ? 1 : -1) * 1.05 : 0;
    const a = c.angle + branch + (p.asymmetry > 0.5 ? r.range(-1.2, 1.2) : r.range(-0.12, 0.12));
    d.angle = a;
    d.x = c.x + Math.cos(a) * rad * 1.25;
    d.y = c.y + Math.sin(a) * rad * 1.25;
    d.z = c.z + r.range(-0.05, 0.05);

    c.size = total * keep;
    c.born = c.size;
    c.divisions++;
    if (isHypha) c.tip = branch !== 0;
    return d;
  }

  /** `live` here is the vegetative count — dormant spores are alive but not growing. */
  private sampleAndClassify(live: number, sumMu: number, sumSpeed: number, sumRes: number): void {
    if (this.t < this.sampleAt) return;
    this.sampleAt = this.t + 6;
    const n = Math.max(1, live);
    this.samples.push({
      t: this.t, pop: live, sub: this.field.totalSubstrate() / (this.field.cols * this.field.rows),
      mu: sumMu / n, speed: sumSpeed / n, res: sumRes / n,
    });
    if (this.samples.length > 1400) this.samples.shift();

    const st = this.stats();
    if (st.generation >= 10) this.achieve('ten-gen', 'ten generations from the inoculum');
    if (this.drug > 0.05 && st.meanRes > this.drug) this.achieve('resistance', 'resistance sweep — mean inherited MIC passed the drug concentration');

    const k = this.samples.length;
    if (k < 12) return;
    const a = this.samples[k - 12], b = this.samples[k - 1];
    const dt = Math.max(1e-6, b.t - a.t);
    const growth = (Math.log(Math.max(1, b.pop)) - Math.log(Math.max(1, a.pop))) / dt;

    let next: Phase = this.phase;
    if (live === 0) next = 'extinct';
    else if (growth > 0.004) next = 'log';
    else if (growth < -0.002) next = 'death';
    else if (live < 20 && this.peakPop > 100) next = 'death';
    else next = this.phase === 'lag' && b.pop <= this.peakPop * 0.25 ? 'lag' : 'stationary';

    // Hysteresis: a phase must hold for two consecutive windows before it is
    // announced, or the stationary/death boundary flaps every sample.
    if (next !== this.pending) { this.pending = next; this.pendingSince = 1; return; }
    if (++this.pendingSince < 2) return;

    if (next !== this.phase) {
      this.phase = next;
      this.note('phase', `${next.toUpperCase()} phase at t+${(this.t / 60).toFixed(1)} h · N=${live}`);
      if (next === 'log') this.achieve('log-phase', 'exponential phase — balanced, unrestricted growth');
      if (next === 'extinct') this.achieve('extinct', 'extinction — every cell on the plate is dead');
    }
  }

  /** Nearest living cell to a point, for the inspect tool. */
  pick(x: number, y: number, radius: number): Cell | null {
    let best: Cell | null = null, bd = radius * radius;
    for (const c of this.cells) {
      const dx = c.x - x, dy = c.y - y, d2 = dx * dx + dy * dy;
      if (d2 < bd) { bd = d2; best = c; }
    }
    return best;
  }

  stats() {
    const live = this.cells.filter((c) => c.state !== DEAD);
    const n = Math.max(1, live.length);
    let gen = 0, mu = 0, sp = 0, res = 0, org = 0, sen = 0;
    for (const c of live) {
      gen += c.gen; mu += c.g.mu; sp += c.g.speed; res += c.g.resistance;
      org += c.organelles; if (c.state === SENESCENT) sen++;
    }
    return {
      pop: live.length, vegetative: live.length - this.spores,
      generation: gen / n, meanMu: mu / n, meanSpeed: sp / n,
      meanRes: res / n, organelles: org, senescent: sen, spores: this.spores,
      born: this.totalBorn, died: this.totalDied, peak: this.peakPop,
      substrate: this.field.totalSubstrate() / (this.field.cols * this.field.rows),
    };
  }
}
