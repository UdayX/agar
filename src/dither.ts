/**
 * Dithering.
 *
 * Ordered matrices are Bayer's recursive construction (Bayer 1973) — stable
 * frame to frame, which matters a lot when the image underneath is moving.
 * The error-diffusion kernels are Floyd–Steinberg (1976) and its descendants;
 * they re-solve the whole frame each time, so they shimmer. That shimmer is
 * a feature in a micrograph and a problem in an interface, so the default here
 * is ordered.
 */
export type Kernel = 'none' | 'bayer2' | 'bayer4' | 'bayer8' | 'floyd' | 'atkinson' | 'jarvis' | 'noise' | 'halftone';

export type RGB = [number, number, number];

function bayer(n: number): Float32Array {
  let m = [[0, 2], [3, 1]];
  let size = 2;
  while (size < n) {
    const next: number[][] = [];
    for (let y = 0; y < size * 2; y++) next.push(new Array(size * 2).fill(0));
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const v = m[y][x] * 4;
        next[y][x] = v;
        next[y][x + size] = v + 2;
        next[y + size][x] = v + 3;
        next[y + size][x + size] = v + 1;
      }
    }
    m = next; size *= 2;
  }
  const out = new Float32Array(n * n);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) out[y * n + x] = m[y][x] / (n * n) - 0.5;
  return out;
}

const BAYER: Record<number, Float32Array> = { 2: bayer(2), 4: bayer(4), 8: bayer(8) };

/** Clustered-dot 8×8 — a real halftone screen rather than a dispersed one. */
const HALFTONE = (() => {
  const order = [
    24, 10, 12, 26, 35, 47, 49, 37, 8, 0, 2, 14, 45, 59, 61, 51,
    22, 6, 4, 16, 43, 57, 63, 53, 30, 20, 18, 28, 33, 41, 55, 39,
    34, 46, 48, 36, 25, 11, 13, 27, 44, 58, 60, 50, 9, 1, 3, 15,
    42, 56, 62, 52, 23, 7, 5, 17, 32, 40, 54, 38, 31, 21, 19, 29,
  ];
  const out = new Float32Array(64);
  for (let i = 0; i < 64; i++) out[i] = order[i] / 64 - 0.5;
  return out;
})();

const DIFFUSION: Record<string, [number, number, number][]> = {
  //           dx, dy, weight
  floyd: [[1, 0, 7 / 16], [-1, 1, 3 / 16], [0, 1, 5 / 16], [1, 1, 1 / 16]],
  atkinson: [[1, 0, 1 / 8], [2, 0, 1 / 8], [-1, 1, 1 / 8], [0, 1, 1 / 8], [1, 1, 1 / 8], [0, 2, 1 / 8]],
  jarvis: [
    [1, 0, 7 / 48], [2, 0, 5 / 48],
    [-2, 1, 3 / 48], [-1, 1, 5 / 48], [0, 1, 7 / 48], [1, 1, 5 / 48], [2, 1, 3 / 48],
    [-2, 2, 1 / 48], [-1, 2, 3 / 48], [0, 2, 5 / 48], [1, 2, 3 / 48], [2, 2, 1 / 48],
  ],
};

export interface DitherOpts {
  kernel: Kernel;
  levels: number;
  contrast: number;
  exposure: number;
  grain: number;
  invert: boolean;
  ink: RGB;
  paper: RGB;
  acid: RGB;
  frame: number;
}

const hash = (x: number, y: number, f: number): number => {
  let h = (x * 374761393 + y * 668265263 + f * 2147483647) | 0;
  h = (h ^ (h >>> 13)) * 1274126177;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

/**
 * Quantise `img` in place. `accent` is an optional per-pixel mask (0/1) marking
 * pixels allowed to take the acid colour instead of ink.
 */
export function ditherImage(img: ImageData, accent: Uint8Array | null, o: DitherOpts): void {
  const { width: w, height: h, data } = img;
  const n = w * h;
  const levels = Math.max(2, Math.round(o.levels));
  const q = levels - 1;

  // 1. luminance, exposure, contrast, grain
  const lum = new Float32Array(n);
  for (let i = 0, p = 0; i < n; i++, p += 4) {
    let v = (data[p] * 0.299 + data[p + 1] * 0.587 + data[p + 2] * 0.114) / 255;
    v = (v - 0.5) * o.contrast + 0.5 + o.exposure;
    if (o.grain > 0) v += (hash(i % w, (i / w) | 0, o.frame) - 0.5) * o.grain;
    lum[i] = v;
  }

  // 2. quantise
  const out = new Float32Array(n);
  const k = o.kernel;
  if (k === 'none') {
    for (let i = 0; i < n; i++) out[i] = Math.min(1, Math.max(0, lum[i]));
  } else if (k === 'floyd' || k === 'atkinson' || k === 'jarvis') {
    const kern = DIFFUSION[k];
    for (let y = 0; y < h; y++) {
      const ltr = (y & 1) === 0;                       // serpentine: fewer worms
      for (let s = 0; s < w; s++) {
        const x = ltr ? s : w - 1 - s;
        const i = y * w + x;
        const old = lum[i];
        const nv = Math.min(1, Math.max(0, Math.round(old * q) / q));
        out[i] = nv;
        const err = old - nv;
        for (const [dx0, dy, wt] of kern) {
          const dx = ltr ? dx0 : -dx0;
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || nx >= w || ny >= h) continue;
          lum[ny * w + nx] += err * wt;
        }
      }
    }
  } else {
    let mat: Float32Array, size: number;
    if (k === 'halftone') { mat = HALFTONE; size = 8; }
    else if (k === 'bayer2') { mat = BAYER[2]; size = 2; }
    else if (k === 'bayer4') { mat = BAYER[4]; size = 4; }
    else if (k === 'bayer8') { mat = BAYER[8]; size = 8; }
    else { mat = BAYER[8]; size = 8; }
    const noise = k === 'noise';
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        const t = noise ? hash(x, y, 0) - 0.5 : mat[(y % size) * size + (x % size)];
        out[i] = Math.min(1, Math.max(0, Math.round((lum[i] + t / q) * q) / q));
      }
    }
  }

  // 3. map to the two-colour-plus-acid palette
  const ink = o.invert ? o.paper : o.ink;
  const paper = o.invert ? o.ink : o.paper;
  for (let i = 0, p = 0; i < n; i++, p += 4) {
    let v = out[i];
    if (o.invert) v = 1 - v;
    const useAcid = accent !== null && accent[i] === 1 && v < 0.999;
    const a: RGB = useAcid ? o.acid : ink;
    data[p] = paper[0] + (a[0] - paper[0]) * (1 - v);
    data[p + 1] = paper[1] + (a[1] - paper[1]) * (1 - v);
    data[p + 2] = paper[2] + (a[2] - paper[2]) * (1 - v);
    data[p + 3] = 255;
  }
}
