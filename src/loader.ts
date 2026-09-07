/**
 * Boot loader.
 *
 * The wordmark is not decoration here — it is the substrate. A handful of cells
 * are seeded inside the logo's own outline and colonise it by Eden growth
 * (occupied sites spread to empty neighbours), rendered through the same dither
 * pipeline the tool uses. By the time the letters are solid, the app is ready.
 *
 * It is deliberately cheap to skip. Anything a person sees on every visit should
 * not cost them time twice: it runs once per session, any click or key ends it,
 * and reduced motion gets a still frame and a fade instead.
 */
import { ditherImage, type RGB } from './dither';
import logoUrl from './AgarLogo.svg';

const SEEN = 'agar.booted';
const CELL = 3;                       // dither grid, device px per sample

export interface BootOpts { paper: RGB; ink: RGB; acid: RGB; }

function loadLogo(): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = logoUrl;
  });
}

export async function runBoot(host: HTMLElement, o: BootOpts): Promise<void> {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let repeat = false;
  try { repeat = sessionStorage.getItem(SEEN) === '1'; } catch { /* private mode */ }

  if (repeat) { host.remove(); return; }
  try { sessionStorage.setItem(SEEN, '1'); } catch { /* ignore */ }

  const canvas = host.querySelector('canvas') as HTMLCanvasElement;
  const ctx = canvas.getContext('2d', { alpha: false })!;

  let img: HTMLImageElement;
  try { img = await loadLogo(); } catch { host.remove(); return; }

  // ── size to the viewport, keeping the wordmark's own proportions ───────
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const aspect = (img.naturalWidth || 3318) / (img.naturalHeight || 468);
  const cssW = Math.min(760, Math.max(280, window.innerWidth * 0.62));
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

  // A few founding colonies, spread across the wordmark so it fills evenly.
  const seedCount = 9;
  for (let k = 0; k < seedCount; k++) {
    const i = sites[Math.floor(((k + 0.5) / seedCount) * sites.length)];
    filled[i] = 1; frontier.push(i);
  }

  const grow = (): void => {
    const next: number[] = [];
    front.fill(0);
    for (const i of frontier) {
      const x = i % gw, y = (i / gw) | 0;
      let stillEdge = false;
      for (let d = 0; d < 4; d++) {
        const nx = x + (d === 0 ? 1 : d === 1 ? -1 : 0);
        const ny = y + (d === 2 ? 1 : d === 3 ? -1 : 0);
        if (nx < 0 || ny < 0 || nx >= gw || ny >= gh) continue;
        const j = ny * gw + nx;
        if (!mask[j] || filled[j]) continue;
        if (Math.random() < 0.62) { filled[j] = 1; front[j] = 1; next.push(j); }
        else stillEdge = true;
      }
      if (stillEdge) next.push(i);
    }
    frontier = next;
  };

  // ── render one frame through the tool's own dither pipeline ───────────
  const buf = document.createElement('canvas');
  buf.width = gw; buf.height = gh;
  const bctx = buf.getContext('2d', { willReadFrequently: true })!;
  const accent = new Uint8Array(n);

  const paint = (): void => {
    const img2 = bctx.createImageData(gw, gh);
    for (let i = 0, q = 0; i < n; i++, q += 4) {
      // Un-colonised letterform is left as a faint stipple, so the wordmark
      // develops like a plate rather than appearing out of nothing.
      const v = filled[i] ? 0 : mask[i] ? 216 : 255;
      img2.data[q] = v; img2.data[q + 1] = v; img2.data[q + 2] = v; img2.data[q + 3] = 255;
      accent[i] = front[i];
    }
    ditherImage(img2, accent, {
      kernel: 'bayer4', levels: 2, contrast: 1, exposure: 0, grain: 0,
      invert: false, ink: o.ink, paper: o.paper, acid: o.acid, frame: 0,
    });
    bctx.putImageData(img2, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(buf, 0, 0, gw, gh, 0, 0, canvas.width, canvas.height);
  };

  const finish = (): void => {
    host.classList.add('is-out');
    host.addEventListener('transitionend', () => host.remove(), { once: true });
    setTimeout(() => host.remove(), 600);
  };

  if (reduced) {
    filled.set(mask);
    paint();
    setTimeout(finish, 420);
    return;
  }

  let done = false;
  const skip = (): void => {
    if (done) return;
    done = true;
    clearTimeout(bail);
    filled.set(mask); front.fill(0);
    paint(); finish();
  };
  // requestAnimationFrame stops in a backgrounded tab, so the growth loop alone
  // could leave someone staring at a frozen overlay. This does not depend on it.
  const bail = setTimeout(skip, 3200);
  host.addEventListener('pointerdown', skip);
  addEventListener('keydown', skip, { once: true });
  document.addEventListener('visibilitychange', () => { if (document.hidden) skip(); });

  await new Promise<void>((resolve) => {
    const started = performance.now();
    const step = (now: number): void => {
      if (done) { resolve(); return; }
      const t = (now - started) / 1000;
      // Growth accelerates: a colony covers ground faster as its front lengthens.
      const rounds = Math.min(6, 1 + Math.floor(t * 5));
      for (let k = 0; k < rounds && frontier.length; k++) grow();
      paint();
      if (!frontier.length || t > 2.4) {
        done = true;
        clearTimeout(bail);
        filled.set(mask); front.fill(0); paint();
        setTimeout(() => { finish(); resolve(); }, 200);
        return;
      }
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });
}
