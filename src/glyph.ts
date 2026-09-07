/**
 * Type → substrate.
 *
 * The letterforms are rasterised once, then read two ways: as a coverage field
 * (the growth medium the colony eats) and as a list of candidate seed sites.
 * Font import uses the platform FontFace API, so any .ttf/.otf/.woff/.woff2 the
 * browser can decode works with no parser dependency.
 */
import type { Params } from './params';

export interface Raster {
  /** Antialiased greyscale of the type, full resolution. Used by plate mode. */
  canvas: HTMLCanvasElement;
  /** Coverage 0–1 per field cell. */
  coverage: Float32Array;
  cols: number;
  rows: number;
  cell: number;
  /** Interleaved x,y of every ink site, full resolution. */
  sites: Float32Array;
}

export const FIELD_CELL = 4;

let importedFamily: string | null = null;
let importedName = '';

export async function importFont(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const family = `agar-import-${Date.now().toString(36)}`;
  const face = new FontFace(family, buf);
  await face.load();
  (document as unknown as { fonts: FontFaceSet }).fonts.add(face);
  importedFamily = family;
  importedName = file.name.replace(/\.[^.]+$/, '');
  return importedName;
}

export const importedFontName = () => importedName;
export const hasImportedFont = () => importedFamily !== null;
export const clearImportedFont = () => { importedFamily = null; importedName = ''; };

function familyFor(p: Params): string {
  return importedFamily ? `"${importedFamily}", ${p.fontFamily}` : p.fontFamily;
}

/** Draw the specimen centred in w×h. Returns the offscreen canvas. */
export function drawType(w: number, h: number, p: Params): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = Math.max(1, w);
  c.height = Math.max(1, h);
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  ctx.clearRect(0, 0, w, h);

  const lines = p.text.split('\n');
  const size = p.fontSize;
  ctx.font = `${p.fontWeight} ${size}px ${familyFor(p)}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#000';
  (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = `${p.tracking * size}px`;

  const lh = size * p.lineHeight;
  const top = h / 2 - ((lines.length - 1) * lh) / 2;
  for (let i = 0; i < lines.length; i++) ctx.fillText(lines[i], w / 2, top + i * lh);
  return c;
}

export function rasterize(w: number, h: number, p: Params): Raster {
  const canvas = drawType(w, h, p);
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height).data;

  const cols = Math.ceil(w / FIELD_CELL);
  const rows = Math.ceil(h / FIELD_CELL);
  const coverage = new Float32Array(cols * rows);

  // Box-downsample alpha into the field grid.
  for (let gy = 0; gy < rows; gy++) {
    for (let gx = 0; gx < cols; gx++) {
      let sum = 0, n = 0;
      const x1 = Math.min(w, (gx + 1) * FIELD_CELL);
      const y1 = Math.min(h, (gy + 1) * FIELD_CELL);
      for (let y = gy * FIELD_CELL; y < y1; y++) {
        let idx = (y * w + gx * FIELD_CELL) * 4 + 3;
        for (let x = gx * FIELD_CELL; x < x1; x++, idx += 4) { sum += img[idx]; n++; }
      }
      coverage[gy * cols + gx] = n ? sum / (n * 255) : 0;
    }
  }

  // Candidate seed sites, sampled on a 3 px lattice inside the ink.
  const step = 3;
  const list: number[] = [];
  for (let y = 0; y < h; y += step) {
    for (let x = 0; x < w; x += step) {
      if (img[(y * w + x) * 4 + 3] > 140) { list.push(x, y); }
    }
  }
  return { canvas, coverage, cols, rows, cell: FIELD_CELL, sites: Float32Array.from(list) };
}
