/**
 * The organism viewer.
 *
 * One WebGL context for the whole Learn page. Each organism is a signed
 * distance function raymarched in a single fragment shader — no meshes, no
 * loader, no library, nothing to download.
 *
 * The reason this is affordable on a weak machine is the house style. The page
 * is dithered, so the render target is one sample per dither cell: a 720 px
 * card is marched at 240 × 240 and scaled up with smoothing off. That is about
 * a twentieth of the fragments a naive full-resolution render would cost, and
 * it is also the only way to get the plate's texture rather than a smooth 3D
 * object sitting awkwardly inside a 1-bit page.
 *
 * Falls back to a flat dithered silhouette when WebGL is missing.
 */
import { ditherImage, type RGB } from './dither';
import type { Form } from './organisms';

export type Quality = 'high' | 'balanced' | 'low';

const FORMS: Form[] = ['capsule', 'cluster', 'helix', 'chain', 'spiked', 'bud', 'branch', 'veins', 'blob'];

const VERT = `
attribute vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
`;

const FRAG = `
precision mediump float;

uniform vec2  uRes;
uniform float uTime;
uniform vec2  uRot;      // yaw, pitch in radians
uniform float uZoom;     // 1 = default framing, >1 closer
uniform int   uForm;
uniform int   uSteps;
uniform vec3  uInk;
uniform vec3  uPaper;
uniform vec3  uAcid;

const float PI = 3.14159265;

// ── primitives ──────────────────────────────────────────────────────────
float sdSphere(vec3 p, float r) { return length(p) - r; }

float sdCapsule(vec3 p, vec3 a, vec3 b, float r) {
  vec3 pa = p - a, ba = b - a;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * h) - r;
}

float sdTorus(vec3 p, float R, float r) {
  return length(vec2(length(p.xz) - R, p.y)) - r;
}

/** Cheap analytic helix: unroll the angle around Y into a repeated offset. */
float sdHelix(vec3 p, float R, float pitch, float r) {
  float a = atan(p.z, p.x);
  float rr = length(p.xz) - R;
  float y = p.y - pitch * a / (2.0 * PI);
  y = mod(y + pitch * 0.5, pitch) - pitch * 0.5;
  return length(vec2(rr, y)) - r;
}

float smin(float a, float b, float k) {
  float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
  return mix(b, a, h) - k * h * (1.0 - h);
}

mat2 rot(float a) { float c = cos(a), s = sin(a); return mat2(c, -s, s, c); }

// ── the library ─────────────────────────────────────────────────────────
// Each organism is drawn at roughly unit scale so one camera frames them all.

float fBacillus(vec3 p) {
  // A rod part-way through division. Two capsules blended just loosely enough
  // to leave the septum visible: one capsule with a torus cut out of it read as
  // a plain rod at every size that matters.
  float a = sdCapsule(p, vec3(-0.66, 0.0, 0.0), vec3(-0.10, 0.0, 0.0), 0.30);
  float b = sdCapsule(p, vec3(0.10, 0.0, 0.0), vec3(0.66, 0.0, 0.0), 0.30);
  return smin(a, b, 0.14);
}

float fCoccus(vec3 p) {
  // Grape-bunch: three planes of division, so the packet is irregular.
  float d = sdSphere(p - vec3(0.34, 0.20, 0.05), 0.42);
  d = smin(d, sdSphere(p - vec3(-0.30, 0.30, -0.18), 0.38), 0.10);
  d = smin(d, sdSphere(p - vec3(-0.10, -0.34, 0.22), 0.40), 0.10);
  d = smin(d, sdSphere(p - vec3(0.30, -0.30, -0.26), 0.34), 0.10);
  return d;
}

float fSpirillum(vec3 p) {
  // sdHelix winds around its input's Y axis, so the axis we want the cell to
  // run along — the screen's x — has to arrive as y.
  vec3 q = vec3(p.y, p.x, p.z);
  float d = sdHelix(q, 0.34, 0.52, 0.115);
  return max(d, abs(p.x) - 0.92);       // a finite cell, not an infinite screw
}

float fFilament(vec3 p) {
  // A chain of cells with one differentiated heterocyst.
  vec3 q = p;
  q.y += sin(p.x * 1.6) * 0.10;         // the chain sags
  float cell = 0.46;
  float ix = floor((q.x + cell * 0.5) / cell);
  float x = q.x - ix * cell;
  float d = sdCapsule(vec3(x, q.y, q.z), vec3(-0.14, 0.0, 0.0), vec3(0.14, 0.0, 0.0), 0.20);
  d = max(d, abs(p.x) - 1.05);
  float het = sdSphere(p - vec3(0.24, sin(0.24 * 1.6) * -0.10, 0.0), 0.30);
  return smin(d, het, 0.06);
}

float fArchaeon(vec3 p) {
  float d = sdCapsule(p, vec3(-0.34, 0.0, 0.0), vec3(0.34, 0.0, 0.0), 0.33);
  // Surface appendages. Explicit, not repeated: eight is enough to read.
  for (int i = 0; i < 8; i++) {
    float fi = float(i);
    float a = fi * (2.0 * PI / 8.0);
    vec3 dir = normalize(vec3(cos(a) * 0.25, sin(a), cos(a * 2.0) * 0.7));
    // mod(), not %: integer modulus is GLSL ES 3.00 and this shader targets 1.00
    // so that it still compiles on the machines this page is meant to run on.
    vec3 base = vec3(mod(fi, 3.0) * 0.22 - 0.22, 0.0, 0.0) + dir * 0.26;
    d = min(d, sdCapsule(p, base, base + dir * 0.42, 0.035));
  }
  return d;
}

float fYeast(vec3 p) {
  float mother = sdSphere(p - vec3(-0.14, 0.0, 0.0), 0.52);
  float bud = sdSphere(p - vec3(0.58, 0.26, 0.06), 0.31);
  float d = smin(mother, bud, 0.07);
  // Bud scars: shallow rings cut into the mother.
  for (int i = 0; i < 3; i++) {
    float a = float(i) * 2.1;
    vec3 n = normalize(vec3(cos(a) * 0.8, sin(a), sin(a * 1.7) * 0.6));
    vec3 c = vec3(-0.14, 0.0, 0.0) + n * 0.50;
    float ring = sdTorus((p - c).xzy, 0.11, 0.035);
    d = max(d, -(ring - 0.02));
  }
  return d;
}

float fMycelium(vec3 p) {
  // Three generations of branching, written out. Recursion is not worth it
  // for a form that only ever needs to read as "a network with tips".
  float d = sdCapsule(p, vec3(-1.0, -0.34, 0.0), vec3(-0.10, -0.05, 0.10), 0.100);
  d = min(d, sdCapsule(p, vec3(-0.10, -0.05, 0.10), vec3(0.62, 0.42, -0.10), 0.085));
  d = min(d, sdCapsule(p, vec3(-0.10, -0.05, 0.10), vec3(0.58, -0.48, 0.28), 0.085));
  d = min(d, sdCapsule(p, vec3(-0.55, -0.20, 0.05), vec3(-0.22, 0.52, -0.30), 0.072));
  d = min(d, sdCapsule(p, vec3(0.62, 0.42, -0.10), vec3(1.02, 0.20, 0.26), 0.058));
  d = min(d, sdCapsule(p, vec3(0.62, 0.42, -0.10), vec3(0.86, 0.86, -0.34), 0.058));
  d = min(d, sdCapsule(p, vec3(0.58, -0.48, 0.28), vec3(1.05, -0.72, 0.05), 0.058));
  d = min(d, sdCapsule(p, vec3(-0.22, 0.52, -0.30), vec3(-0.40, 0.95, -0.10), 0.050));
  return d;
}

float fSlime(vec3 p) {
  // A flattened sheet pulled into veins between food points.
  float d = sdSphere(p * vec3(1.0, 2.1, 1.0), 0.54) / 2.1;
  for (int i = 0; i < 5; i++) {
    float a = float(i) * (2.0 * PI / 5.0) + 0.4;
    vec3 tip = vec3(cos(a) * 0.84, sin(a * 1.6) * 0.14, sin(a) * 0.84);
    d = smin(d, sdCapsule(p, vec3(0.0), tip, 0.075), 0.20);
    d = smin(d, sdSphere(p - tip, 0.14), 0.13);
  }
  return d;
}

float fAmoeba(vec3 p) {
  // Pseudopods that creep: the phase is time, so it never settles.
  float d = sdSphere(p, 0.56);
  for (int i = 0; i < 4; i++) {
    float f = float(i);
    float a = f * 1.57 + uTime * 0.18;
    vec3 tip = vec3(cos(a) * 0.86, sin(a * 1.3 + f) * 0.52, sin(a * 0.8 + f) * 0.86);
    d = smin(d, sdCapsule(p, vec3(0.0), tip, 0.17 + 0.04 * sin(f + uTime * 0.4)), 0.26);
  }
  // Low-frequency surface relief. Small enough not to break the march.
  d += 0.035 * sin(p.x * 5.0 + uTime * 0.3) * sin(p.y * 4.4) * sin(p.z * 5.2);
  return d;
}

float map(vec3 p) {
  if (uForm == 0) return fBacillus(p);
  if (uForm == 1) return fCoccus(p);
  if (uForm == 2) return fSpirillum(p);
  if (uForm == 3) return fFilament(p);
  if (uForm == 4) return fArchaeon(p);
  if (uForm == 5) return fYeast(p);
  if (uForm == 6) return fMycelium(p);
  if (uForm == 7) return fSlime(p);
  return fAmoeba(p);
}

vec3 normalAt(vec3 p) {
  vec2 e = vec2(0.0022, 0.0);
  return normalize(vec3(
    map(p + e.xyy) - map(p - e.xyy),
    map(p + e.yxy) - map(p - e.yxy),
    map(p + e.yyx) - map(p - e.yyx)));
}

// Recursive Bayer, computed rather than sampled — no texture, no upload.
float bayer2(vec2 a) { a = floor(a); return fract(a.x / 2.0 + a.y * a.y * 0.75); }
float bayer8(vec2 a) {
  return bayer2(0.25 * a) * 0.0625 + bayer2(0.5 * a) * 0.25 + bayer2(a);
}

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * uRes) / min(uRes.x, uRes.y);

  vec3 ro = vec3(0.0, 0.0, 3.9 / uZoom);
  vec3 rd = normalize(vec3(uv * 1.15, -1.6));

  // Orbit the camera, not the object: the lighting then stays put and the
  // form reads as turning in a fixed room.
  mat2 rp = rot(uRot.y), ry = rot(uRot.x);
  ro.yz = rp * ro.yz; rd.yz = rp * rd.yz;
  ro.xz = ry * ro.xz; rd.xz = ry * rd.xz;

  float t = 0.0;
  float hit = 0.0;
  for (int i = 0; i < 96; i++) {
    if (i >= uSteps) break;
    vec3 p = ro + rd * t;
    float d = map(p);
    if (d < 0.0016) { hit = 1.0; break; }
    t += d * 0.78;                 // relaxed: the displaced forms are not exact
    if (t > 7.0) break;
  }

  // dark is ink coverage, not brightness: 0 is bare paper, 1 is solid. A miss
  // is bare paper, which is the whole reason it is measured this way round.
  float dark = 0.0;
  float rim = 0.0;
  if (hit > 0.5) {
    vec3 p = ro + rd * t;
    vec3 n = normalAt(p);
    vec3 l = normalize(vec3(-0.45, 0.72, 0.55));
    float diff = max(dot(n, l), 0.0);
    float amb = 0.34 + 0.30 * n.y;
    // Contact darkening with depth so the form has a near and a far side.
    float depth = clamp((t - 2.6) / 2.0, 0.0, 1.0);
    float shade = clamp(0.10 + diff * 0.72 + amb * 0.26 - depth * 0.30, 0.0, 1.0);
    // Never fully white and never fully black: a highlight that reaches bare
    // paper punches a hole in the silhouette, and a shadow that reaches solid
    // ink loses the dither that everything else on the page is made of.
    dark = mix(0.94, 0.12, shade);
    rim = pow(1.0 - max(dot(n, -rd), 0.0), 3.0);
  }

  float b = bayer8(gl_FragCoord.xy) - 0.5;
  float q = step(0.5, dark + b * 0.72);
  vec3 col = mix(uPaper, uInk, q);
  // The accent lives only on the silhouette edge, the same way it does on the
  // plate: one colour, used to say "this is the growing edge".
  if (hit > 0.5 && rim > 0.55 && step(0.5, rim + b * 0.5) > 0.5) col = uAcid;

  gl_FragColor = vec4(col, 1.0);
}
`;

export interface ViewerOpts { ink: RGB; paper: RGB; acid: RGB; }

export interface Viewer {
  readonly el: HTMLCanvasElement;
  show(form: Form): void;
  /** css pixels; the render target is this divided by the dither cell. */
  size(w: number, h: number): void;
  zoom(z: number): void;
  /** Jump the zoom with no easing — for handing the viewer to a new host. */
  setZoom(z: number): void;
  spin(on: boolean): void;
  start(): void;
  stop(): void;
  quality(q: Quality): void;
}

const STEPS: Record<Quality, number> = { high: 88, balanced: 64, low: 40 };
const CELLS: Record<Quality, number> = { high: 3, balanced: 4, low: 6 };

export function createViewer(canvas: HTMLCanvasElement, o: ViewerOpts): Viewer {
  const gl = (canvas.getContext('webgl', { antialias: false, alpha: false, depth: false, powerPreference: 'low-power' })
    ?? canvas.getContext('experimental-webgl')) as WebGLRenderingContext | null;

  if (!gl) return flatFallback(canvas, o);

  const compile = (type: number, src: string): WebGLShader | null => {
    const s = gl.createShader(type)!;
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      // Falling back silently is how a broken shader ships. Say it out loud.
      console.warn('[agar] organism shader failed to compile:', gl.getShaderInfoLog(s));
      gl.deleteShader(s);
      return null;
    }
    return s;
  };
  const vs = compile(gl.VERTEX_SHADER, VERT);
  const fs = compile(gl.FRAGMENT_SHADER, FRAG);
  if (!vs || !fs) return flatFallback(canvas, o);

  const prog = gl.createProgram()!;
  gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return flatFallback(canvas, o);
  gl.useProgram(prog);

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const aPos = gl.getAttribLocation(prog, 'aPos');
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

  const u = (n: string) => gl.getUniformLocation(prog, n);
  const uRes = u('uRes'), uTime = u('uTime'), uRot = u('uRot'), uZoom = u('uZoom');
  const uForm = u('uForm'), uSteps = u('uSteps');
  const n1 = (c: RGB): [number, number, number] => [c[0] / 255, c[1] / 255, c[2] / 255];
  gl.uniform3fv(u('uInk'), n1(o.ink));
  gl.uniform3fv(u('uPaper'), n1(o.paper));
  gl.uniform3fv(u('uAcid'), n1(o.acid));

  let q: Quality = 'balanced';
  let form = 0;
  let cssW = 320, cssH = 320;
  let yaw = 0.6, pitch = -0.15;
  let tYaw = 0.6, tPitch = -0.15;
  let zoomNow = 1, zoomTo = 1;
  let spinning = true;
  let raf = 0;
  let t0 = performance.now();
  let held = false;

  const resize = (): void => {
    const cell = CELLS[q];
    const w = Math.max(32, Math.round(cssW / cell));
    const h = Math.max(32, Math.round(cssH / cell));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w; canvas.height = h;
    }
    canvas.style.width = `${cssW}px`;
    canvas.style.height = `${cssH}px`;
    gl.viewport(0, 0, w, h);
    gl.uniform2f(uRes, w, h);
  };

  const render = (now: number): void => {
    const t = (now - t0) / 1000;
    if (spinning && !held) tYaw += 0.0042;
    // Ease towards the target so a released drag coasts instead of stopping.
    yaw += (tYaw - yaw) * 0.12;
    pitch += (tPitch - pitch) * 0.12;
    zoomNow += (zoomTo - zoomNow) * 0.10;
    gl.uniform1f(uTime, t);
    gl.uniform2f(uRot, yaw, pitch);
    gl.uniform1f(uZoom, zoomNow);
    gl.uniform1i(uForm, form);
    gl.uniform1i(uSteps, STEPS[q]);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };

  const loop = (now: number): void => { render(now); raf = requestAnimationFrame(loop); };

  // ── orbit ─────────────────────────────────────────────────────────────
  let px = 0, py = 0;
  const down = (e: PointerEvent): void => {
    held = true; px = e.clientX; py = e.clientY;
    canvas.setPointerCapture(e.pointerId);
    canvas.classList.add('is-held');
  };
  const move = (e: PointerEvent): void => {
    if (!held) return;
    tYaw += (e.clientX - px) * 0.008;
    tPitch = Math.max(-1.25, Math.min(1.25, tPitch - (e.clientY - py) * 0.008));
    px = e.clientX; py = e.clientY;
    if (!raf) render(performance.now());
  };
  const up = (): void => { held = false; canvas.classList.remove('is-held'); };
  canvas.addEventListener('pointerdown', down);
  canvas.addEventListener('pointermove', move);
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', up);

  resize();

  return {
    el: canvas,
    show(f: Form) { form = Math.max(0, FORMS.indexOf(f)); if (!raf) render(performance.now()); },
    size(w, h) { cssW = w; cssH = h; resize(); if (!raf) render(performance.now()); },
    zoom(z) { zoomTo = z; },
    setZoom(z) { zoomTo = z; zoomNow = z; },
    spin(on) { spinning = on; },
    start() { if (!raf) { t0 = performance.now() - 1000; raf = requestAnimationFrame(loop); } },
    stop() { if (raf) cancelAnimationFrame(raf); raf = 0; },
    quality(next) { q = next; resize(); if (!raf) render(performance.now()); },
  };
}

/**
 * No WebGL. Draw the organism as a flat dithered silhouette through the same
 * pipeline the plate uses, so the page still reads rather than showing a hole.
 */
function flatFallback(canvas: HTMLCanvasElement, o: ViewerOpts): Viewer {
  const ctx = canvas.getContext('2d');
  let cssW = 320, cssH = 320, form: Form = 'capsule';

  const paint = (): void => {
    if (!ctx) return;
    const w = Math.max(32, Math.round(cssW / 3));
    const h = Math.max(32, Math.round(cssH / 3));
    canvas.width = w; canvas.height = h;
    canvas.style.width = `${cssW}px`;
    canvas.style.height = `${cssH}px`;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#000';
    const s = Math.min(w, h) * 0.32;
    const cx = w / 2, cy = h / 2;
    const blob = (x: number, y: number, rx: number, ry: number): void => {
      ctx.beginPath(); ctx.ellipse(cx + x * s, cy + y * s, rx * s, ry * s, 0, 0, Math.PI * 2); ctx.fill();
    };
    if (form === 'cluster') { blob(0.35, 0.2, 0.45, 0.45); blob(-0.3, 0.3, 0.4, 0.4); blob(-0.1, -0.35, 0.42, 0.42); }
    else if (form === 'bud') { blob(-0.15, 0, 0.55, 0.55); blob(0.55, 0.2, 0.3, 0.3); }
    else if (form === 'chain') { for (let i = -2; i <= 2; i++) blob(i * 0.5, 0, 0.22, 0.22); }
    else if (form === 'helix') { for (let i = 0; i < 26; i++) { const a = i / 25; blob(a * 2 - 1, Math.sin(a * 9) * 0.42, 0.13, 0.13); } }
    else if (form === 'branch' || form === 'veins') {
      for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2; for (let k = 0; k < 12; k++) { const r = k / 11; blob(Math.cos(a) * r, Math.sin(a) * r, 0.09, 0.09); } }
    } else blob(0, 0, 1, 0.42);

    const frame = ctx.getImageData(0, 0, w, h);
    ditherImage(frame, null, {
      kernel: 'bayer8', levels: 2, contrast: 1, exposure: 0, grain: 0,
      invert: false, ink: o.ink, paper: o.paper, acid: o.acid, frame: 0,
    });
    ctx.putImageData(frame, 0, 0);
  };

  return {
    el: canvas,
    show(f) { form = f; paint(); },
    size(w, h) { cssW = w; cssH = h; paint(); },
    zoom() {}, setZoom() {}, spin() {}, start() {}, stop() {}, quality() {},
  };
}
