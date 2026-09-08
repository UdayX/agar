/**
 * Boot sequence.
 *
 * Four beats, in the order the tool itself works:
 *
 *   1. FORM        the wordmark wipes in solid — you see the logo first
 *   2. DITHER      it breaks apart into a halftone; the letters become a grid
 *   3. COLONISE    the grid becomes cells, which grow back over the letterform
 *                  while free-swimming scouts drift in and are absorbed
 *   4. CONFLUENT   the plate fills, and the lab opens behind it
 *
 * It is deliberately cheap to leave. Anything seen on every visit must not cost
 * time twice: it runs once per session, any click or key ends it, reduced
 * motion gets a still frame, and a timer independent of requestAnimationFrame
 * guarantees it can never strand someone behind a frozen overlay.
 */
import { ditherImage, type RGB } from './dither';
import logoUrl from './AgarLogo.svg';

const SEEN = 'agar.booted';
const CELL = 3;                       // dither grid, device px per sample

/** Beat boundaries in seconds. */
const T_FORM = 0.85;
const T_DITHER = 1.65;
const T_COLONISE = 4.25;
const T_END = 4.9;

export interface BootOpts { paper: RGB; ink: RGB; acid: RGB; }

interface Scout { x: number; y: number; a: number; alive: boolean; }

function loadLogo(): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = logoUrl;
  });
}

const easeOut = (t: number): number => 1 - Math.pow(1 - t, 3);
const clamp01 = (t: number): number => (t < 0 ? 0 : t > 1 ? 1 : t);

export async function runBoot(host: HTMLElement, o: BootOpts): Promise<void> {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let repeat = false;
  try { repeat = sessionStorage.getItem(SEEN) === '1'; } catch { /* private mode */ }

  if (repeat) { host.remove(); return; }
  try { sessionStorage.setItem(SEEN, '1'); } catch { /* ignore */ }

  const canvas = host.querySelector('canvas') as HTMLCanvasElement;
  const cap = host.querySelector('.boot-cap') as HTMLElement | null;
  const pct = host.querySelector('.boot-pct') as HTMLElement | null;
  const ctx = canvas.getContext('2d', { alpha: false })!;

  let img: HTMLImageElement;
  try { img = await loadLogo(); } catch { host.remove(); return; }

  // ── size to the viewport, keeping the wordmark's own proportions ───────
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const aspect = (img.naturalWidth || 3318) / (img.naturalHeight || 468);
  const cssW = Math.min(720, Math.max(260, window.innerWidth * 0.58));
  const cssH = Math.round(cssW / aspect);
  canvas.style.width = `${cssW}px`;
  canvas.style.height = `${cssH}px`;
  canvas.width = Math.round(cssW * dpr);
  canvas.height = Math.round(cssH * dpr);

  const gw = Math.max(8, Math.ceil(canvas.width / CELL));
  const gh = Math.max(4, Math.ceil(canvas.height / CELL));

  // ── the logo becomes a mask of habitable sites ────────────────────────
  const maskCanvas = document.createElement('canvas');
  maskCanvas.width = gw; maskCanvas.height = gh;
  const mctx = maskCanvas.getContext('2d', { willReadFrequently: true })!;
  mctx.drawImage(img, 0, 0, gw, gh);
  const alpha = mctx.getImageData(0, 0, gw, gh).data;

  const n = gw * gh;
  const mask = new Uint8Array(n);
  const sites: number[] = [];
  for (let i = 0; i < n; i++) {
    if (alpha[i * 4 + 3] > 110) { mask[i] = 1; sites.push(i); }
  }
  if (!sites.length) { host.remove(); return; }

  const filled = new Uint8Array(n);
  const front = new Uint8Array(n);
  let frontier: number[] = [];

  /** Thin the solid letterform down to a scatter of founders. */
  const inoculate = (): void => {
    filled.fill(0);
    frontier = [];
    for (const i of sites) {
      if (Math.random() < 0.16) { filled[i] = 1; frontier.push(i); }
    }
    if (!frontier.length) { filled[sites[0]] = 1; frontier.push(sites[0]); }
  };

  const grow = (): void => {
    const next: number[] = [];
    for (const i of frontier) {
      const x = i % gw, y = (i / gw) | 0;
      let stillEdge = false;
      for (let d = 0; d < 4; d++) {
        const nx = x + (d === 0 ? 1 : d === 1 ? -1 : 0);
        const ny = y + (d === 2 ? 1 : d === 3 ? -1 : 0);
        if (nx < 0 || ny < 0 || nx >= gw || ny >= gh) continue;
        const j = ny * gw + nx;
        if (!mask[j] || filled[j]) continue;
        if (Math.random() < 0.58) { filled[j] = 1; front[j] = 1; next.push(j); }
        else stillEdge = true;
      }
      if (stillEdge) next.push(i);
    }
    frontier = next;
  };

  // Free-swimming cells that drift in from the margins and are absorbed by the
  // colony. Run-and-tumble, same as the tool: they never steer, they only
  // tumble less often while they happen to be closing on the wordmark.
  const scouts: Scout[] = [];
  for (let k = 0; k < 46; k++) {
    scouts.push({ x: Math.random() * gw, y: Math.random() * gh, a: Math.random() * Math.PI * 2, alive: true });
  }
  const cx = gw / 2, cy = gh / 2;
  const swimScouts = (dt: number): void => {
    const v = 26 * dt;                       // grid cells per second
    for (const s of scouts) {
      if (!s.alive) continue;
      const before = Math.hypot(s.x - cx, s.y - cy);
      s.x += Math.cos(s.a) * v;
      s.y += Math.sin(s.a) * v;
      const after = Math.hypot(s.x - cx, s.y - cy);
      // tumble rate drops while the sensed direction is improving
      if (Math.random() < (after < before ? 0.6 : 2.6) * dt) s.a += (Math.random() - 0.5) * 2.4;
      if (s.x < 0) s.x += gw; else if (s.x >= gw) s.x -= gw;
      if (s.y < 0) s.y += gh; else if (s.y >= gh) s.y -= gh;
      const j = ((s.y | 0) * gw + (s.x | 0)) | 0;
      if (filled[j]) s.alive = false;        // absorbed into the colony
    }
  };

  // ── render one frame through the tool's own dither pipeline ───────────
  const buf = document.createElement('canvas');
  buf.width = gw; buf.height = gh;
  const bctx = buf.getContext('2d', { willReadFrequently: true })!;
  const accent = new Uint8Array(n);

  /**
   * `wipe` reveals the solid mark left to right; `loose` (0→1) lifts the
   * letterform off pure black towards a mid grey, which is what makes the
   * ordered dither visibly break it into dots. `live` swaps the solid mark for
   * the growing colony.
   */
  const paint = (wipe: number, loose: number, live: boolean): void => {
    const edge = wipe * gw;
    const body = Math.round(loose * 158);       // 0 = solid ink, 158 = halftone
    const frame = bctx.createImageData(gw, gh);
    const data = frame.data;
    for (let i = 0, q = 0; i < n; i++, q += 4) {
      let v = 255;
      if (mask[i] && i % gw <= edge) {
        // Un-colonised letterform is a faint stipple, so the wordmark develops
        // like a plate rather than appearing out of nothing.
        v = live ? (filled[i] ? 0 : 222) : body;
      }
      data[q] = data[q + 1] = data[q + 2] = v;
      data[q + 3] = 255;
      accent[i] = front[i];
    }
    if (live) {
      for (const s of scouts) {
        if (!s.alive) continue;
        const q = (((s.y | 0) * gw + (s.x | 0)) | 0) * 4;
        data[q] = data[q + 1] = data[q + 2] = 40;
      }
    }
    ditherImage(frame, accent, {
      kernel: 'bayer8', levels: 2, contrast: 1, exposure: 0, grain: 0,
      invert: false, ink: o.ink, paper: o.paper, acid: o.acid, frame: 0,
    });
    bctx.putImageData(frame, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(buf, 0, 0, gw, gh, 0, 0, canvas.width, canvas.height);
  };

  const setCap = (text: string, p: number): void => {
    if (cap && cap.textContent !== text) cap.textContent = text;
    if (pct) pct.textContent = String(Math.min(100, Math.round(p * 100))).padStart(3, '0');
  };

  const finish = (): void => {
    host.classList.add('is-out');
    host.addEventListener('transitionend', () => host.remove(), { once: true });
    setTimeout(() => host.remove(), 700);
  };

  if (reduced) {
    filled.set(mask);
    paint(1, 0, true);
    setCap('Ready', 1);
    host.classList.add('is-lit');
    setTimeout(finish, 700);
    return;
  }

  let done = false;
  const skip = (): void => {
    if (done) return;
    done = true;
    clearTimeout(bail);
    filled.set(mask); front.fill(0);
    for (const s of scouts) s.alive = false;
    paint(1, 0, true);
    setCap('Ready', 1);
    // Leave on the resolved state, not mid-fade, whichever beat we cut from.
    host.classList.add('is-lit');
    finish();
  };
  // requestAnimationFrame stops in a backgrounded tab, so the growth loop alone
  // could leave someone staring at a frozen overlay. This does not depend on it.
  const bail = setTimeout(skip, T_END * 1000 + 4000);
  host.addEventListener('pointerdown', skip);
  addEventListener('keydown', skip, { once: true });
  document.addEventListener('visibilitychange', () => { if (document.hidden) skip(); });

  await new Promise<void>((resolve) => {
    const started = performance.now();
    let last = started;
    let seeded = false;

    const step = (now: number): void => {
      if (done) { resolve(); return; }
      const t = (now - started) / 1000;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;

      if (t < T_FORM) {
        // 1. the mark itself, wiping in solid
        const w = easeOut(t / T_FORM);
        paint(w, 0, false);
        setCap('Plating', w * 0.25);
      } else if (t < T_DITHER) {
        // 2. it comes apart into a halftone
        const d = clamp01((t - T_FORM) / (T_DITHER - T_FORM));
        paint(1, easeOut(d), false);
        host.classList.add('is-lit');
        setCap('Dithering', 0.25 + d * 0.2);
      } else if (t < T_COLONISE) {
        // 3. the halftone becomes cells, and the cells grow
        if (!seeded) { seeded = true; inoculate(); }
        const d = clamp01((t - T_DITHER) / (T_COLONISE - T_DITHER));
        front.fill(0);
        const rounds = Math.min(5, 1 + Math.floor(d * 6));
        for (let k = 0; k < rounds && frontier.length; k++) grow();
        swimScouts(dt);
        paint(1, 0, true);
        setCap('Culturing', 0.45 + d * 0.5);
        if (!frontier.length) { last = now; }
      } else {
        // 4. confluent
        filled.set(mask); front.fill(0);
        for (const s of scouts) s.alive = false;
        paint(1, 0, true);
        setCap('Confluent', 1);
        if (t > T_END) {
          done = true;
          clearTimeout(bail);
          finish();
          resolve();
          return;
        }
      }
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });
}
