/**
 * The footer culture.
 *
 * A live plate at the foot of the page: black cells swim over an acid ground
 * and settle into the wordmark, which is never quite finished — a slice of the
 * colony keeps detaching and swimming back, so the mark breathes instead of
 * resolving once and freezing.
 *
 * Same pipeline as everything else. Cells deposit into a density field, the
 * field is quantised by an ordered dither, and the result is drawn at grid
 * resolution with smoothing off. Nothing here is an image of the logo; it is
 * the logo as an attractor.
 *
 * It costs nothing when it is off screen: an IntersectionObserver stops the
 * loop, and reduced motion gets a single settled frame.
 */
import { ditherImage, type RGB } from './dither';
import logoUrl from './AgarLogo.svg';

const CELL = 3;                       // device px per dither sample
const SETTLE = 0.055;                 // how hard a cell is pulled to its site
const JITTER = 0.13;                  // brownian wobble once settled
const CHURN = 0.0004;                 // chance per cell per frame of detaching

/** `free` is the seconds of swimming left before this cell commits to its site. */
interface Cell { x: number; y: number; tx: number; ty: number; free: number; a: number; }

export interface FooterOpts { ink: RGB; acid: RGB; }

/**
 * @param canvas the footer canvas
 * @param o      ink = the cells, acid = the ground they sit on
 * @returns a teardown function
 */
export function runFooter(canvas: HTMLCanvasElement, o: FooterOpts): () => void {
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) return () => {};

  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  // Deliberately 1: the band is a dither, so a device pixel and a sample should
  // be the same thing. Retina would only make the cells too fine to read.
  const dpr = 1;

  let gw = 0, gh = 0, n = 0;
  let density = new Float32Array(0);
  let cells: Cell[] = [];
  let buf: HTMLCanvasElement | null = null;
  let bctx: CanvasRenderingContext2D | null = null;
  let raf = 0;
  let visible = false;
  let ready = false;

  const img = new Image();

  /** Rebuild the grid, the mask and the population for the current size. */
  const layout = (): void => {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (!w || !h || !ready) return;

    canvas.width = Math.max(1, Math.round(w * dpr));
    canvas.height = Math.max(1, Math.round(h * dpr));
    gw = Math.max(8, Math.ceil(canvas.width / CELL));
    gh = Math.max(4, Math.ceil(canvas.height / CELL));
    n = gw * gh;
    density = new Float32Array(n);

    buf = document.createElement('canvas');
    buf.width = gw; buf.height = gh;
    bctx = buf.getContext('2d', { willReadFrequently: true });

    // Fit the wordmark inside the band with a margin on every side.
    const aspect = (img.naturalWidth || 3318) / (img.naturalHeight || 468);
    const mw = Math.min(gw * 0.86, gh * 0.66 * aspect);
    const mh = mw / aspect;
    const ox = (gw - mw) / 2;
    const oy = (gh - mh) / 2;

    const mc = document.createElement('canvas');
    mc.width = gw; mc.height = gh;
    const mctx = mc.getContext('2d', { willReadFrequently: true })!;
    mctx.drawImage(img, ox, oy, mw, mh);
    const alpha = mctx.getImageData(0, 0, gw, gh).data;

    const sites: number[] = [];
    for (let i = 0; i < n; i++) if (alpha[i * 4 + 3] > 110) sites.push(i);
    if (!sites.length) return;

    // One cell per few mask sites — dense enough to read as letters, sparse
    // enough that the dither still has tones to work with.
    const want = Math.max(160, Math.min(11000, Math.round(sites.length * 1.3)));
    cells = [];
    for (let k = 0; k < want; k++) {
      const s = sites[(Math.random() * sites.length) | 0];
      cells.push({
        x: Math.random() * gw, y: Math.random() * gh,
        tx: s % gw, ty: (s / gw) | 0,
        free: reduced ? 0 : 0.8 + Math.random() * 1.2,
        a: Math.random() * Math.PI * 2,
      });
    }
    if (reduced) { for (const c of cells) { c.x = c.tx; c.y = c.ty; } }
  };

  const stepCells = (dt: number): void => {
    // A free cell closes on its site exponentially while wandering across the
    // approach, which reads as swimming. Pure run-and-tumble would be truer to
    // the biology and would also take twenty seconds to cross the band — this
    // is the one place in the project where the look wins.
    //
    // Arrival is on a clock, not on a distance test: the wander fades to nothing
    // as the clock runs out, so every cell is guaranteed to land. A distance
    // test leaves a tail of cells orbiting a couple of grid squares off target,
    // which is enough to blur the counters shut and stop the mark reading.
    const draw = Math.min(1, dt * 3.4);
    for (const c of cells) {
      if (c.free > 0) {
        c.free -= dt;
        const ease = Math.max(0, Math.min(1, c.free));   // 1 → 0 over the last second
        const wander = 30 * dt * ease * ease;
        c.a += (Math.random() - 0.5) * 9 * dt;
        c.x += (c.tx - c.x) * draw + Math.cos(c.a) * wander;
        c.y += (c.ty - c.y) * draw + Math.sin(c.a) * wander * 0.5;
      } else {
        c.x += (c.tx - c.x) * SETTLE + (Math.random() - 0.5) * JITTER;
        c.y += (c.ty - c.y) * SETTLE + (Math.random() - 0.5) * JITTER;
        // A settled cell occasionally lets go and swims a lap.
        if (Math.random() < CHURN) {
          c.free = 1.1 + Math.random() * 1.4;
          c.a = Math.random() * Math.PI * 2;
          c.x += (Math.random() - 0.5) * 26;
          c.y += (Math.random() - 0.5) * 14;
        }
      }
    }
  };

  const paint = (): void => {
    if (!bctx || !buf) return;
    density.fill(0);
    // One site, one deposit — no spill. Any wider kernel bleeds across the
    // counters and the wordmark stops being letters. The texture comes from the
    // cells instead: sites are claimed at random, so roughly a third stay empty
    // and the letterform fills in as a stipple rather than a slab.
    for (const c of cells) {
      const xi = c.x | 0, yi = c.y | 0;
      if (xi < 0 || yi < 0 || xi >= gw || yi >= gh) continue;
      density[yi * gw + xi] += 1;
    }

    const frame = bctx.createImageData(gw, gh);
    const data = frame.data;
    for (let i = 0, q = 0; i < n; i++, q += 4) {
      const v = 255 - Math.min(255, density[i] * 200);
      data[q] = data[q + 1] = data[q + 2] = v;
      data[q + 3] = 255;
    }
    // ink = the cells, paper = the acid ground they grow on.
    ditherImage(frame, null, {
      kernel: 'bayer8', levels: 2, contrast: 1, exposure: 0, grain: 0,
      invert: false, ink: o.ink, paper: o.acid, acid: o.ink, frame: 0,
    });
    bctx.putImageData(frame, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(buf, 0, 0, gw, gh, 0, 0, canvas.width, canvas.height);
  };

  let last = 0;
  const tick = (now: number): void => {
    raf = 0;
    if (!visible) return;
    const dt = last ? Math.min(0.05, (now - last) / 1000) : 0.016;
    last = now;
    stepCells(dt);
    paint();
    raf = requestAnimationFrame(tick);
  };

  const start = (): void => {
    if (raf || !ready) return;
    last = 0;
    raf = requestAnimationFrame(tick);
  };
  const stop = (): void => {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  };

  // Only alive while it is actually on screen.
  const io = new IntersectionObserver((entries) => {
    visible = entries.some((e) => e.isIntersecting);
    if (visible && !reduced) start(); else stop();
  }, { rootMargin: '120px' });

  let resizeT = 0;
  const onResize = (): void => {
    clearTimeout(resizeT);
    resizeT = window.setTimeout(() => { layout(); paint(); }, 160);
  };

  img.onload = () => {
    ready = true;
    layout();
    if (reduced) { paint(); return; }   // one settled frame, no loop
    // Let the swarm converge once before anyone scrolls down to it. Real frame
    // steps, not big ones — the approach is time-based, so coarse steps would
    // settle the cells somewhere other than where the live loop puts them.
    for (let k = 0; k < 200; k++) stepCells(1 / 60);
    paint();
    io.observe(canvas);
    addEventListener('resize', onResize);
  };
  img.src = logoUrl;

  return () => {
    stop();
    io.disconnect();
    removeEventListener('resize', onResize);
    clearTimeout(resizeT);
  };
}
