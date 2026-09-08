/**
 * The chemotactic cursor.
 *
 * A handful of cells that run and tumble near the pointer, biased the same
 * way every other population on this site is: no steering, ever — just a
 * lower tumble rate on a step that happened to close the gap, and a higher
 * one on a step that opened it. Berg & Brown 1972, the same law as
 * `loader.ts`'s scouts. Move slowly and the swarm gathers; move fast and it
 * falls behind and has to search. The pointer is an attractant source, not a
 * destination it is steered toward, and the native cursor is never touched —
 * this is a companion, not a replacement.
 *
 * It costs nothing while the pointer is still: the loop stops after 2.5s of
 * no movement and restarts on the next `pointermove`. It is also silent over
 * the plate, which draws its own cursor and its own cells.
 */
import type { RGB } from './dither';
import { initPerf, onTier } from './perf';

const CELL = 3;                        // device px per sample — dpr is forced to 1 below
const SPEED = 96;                      // px/s, free swimming
const NEAR = 34;                       // px — inside this radius the pointer is milled, not chased
const TUMBLE_CLOSING = 0.6;            // /s — loader.ts's constant, unchanged
const TUMBLE_AWAY = 2.6;               // /s — loader.ts's constant, unchanged
const TURN = 2.4;                      // rad, the tumble reorientation
const BIAS_DECAY = 0.45;               // s — how long a pointerdown pulse holds the group
const IDLE_AT = 2500;                  // ms of stillness before the swarm starts coasting to a stop
const IDLE_DECAY = 600;                // ms over which it coasts to zero, then the loop stops

interface Cell { x: number; y: number; a: number; }

export function runCursor(o: { ink: RGB }): () => void {
  // Checked once, at startup — never on a touch device, never with reduced
  // motion, never on a machine too weak to spare the frame.
  if (matchMedia('(pointer: coarse)').matches) return () => {};
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return () => {};
  const tier = initPerf();
  if (tier === 'low') return () => {};

  const canvas = document.createElement('canvas');
  canvas.className = 'swarm';
  canvas.setAttribute('aria-hidden', 'true');
  document.body.appendChild(canvas);
  const ctx = canvas.getContext('2d');
  if (!ctx) { canvas.remove(); return () => {}; }

  // Deliberately 1, same reasoning as footer.ts: this is a dither, so one
  // device pixel should be one sample, not something smoothed toward it.
  const dpr = 1;

  const N = tier === 'high' ? 6 : 4;
  let cells: Cell[] = [];
  let seeded = false;

  let px = 0, py = 0;
  let away = false;                    // over the plate — its own cursor, its own cells
  let dormant = false;                 // the low performance tier, which a person can undo
  let bias = 0;                        // 1 → 0 after a pointerdown pulse
  let lastMove = 0;
  let raf = 0;
  let last = 0;
  let prevBox: { x0: number; y0: number; x1: number; y1: number } | null = null;

  const layout = (): void => {
    canvas.width = Math.max(1, Math.round(window.innerWidth * dpr));
    canvas.height = Math.max(1, Math.round(window.innerHeight * dpr));
    // Setting width or height resets every property on the context, so the
    // alpha and the fill have to be restated here rather than once at startup —
    // otherwise the swarm comes back solid black after the first resize.
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = `rgb(${o.ink[0]}, ${o.ink[1]}, ${o.ink[2]})`;
    prevBox = null;                    // last frame's rect means nothing at a new size
  };
  layout();

  const seed = (): void => {
    cells = [];
    for (let i = 0; i < N; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 40 + Math.random() * 80;
      cells.push({ x: px + Math.cos(a) * r, y: py + Math.sin(a) * r, a: Math.random() * Math.PI * 2 });
    }
    seeded = true;
  };

  const step = (dt: number, speedScale: number): void => {
    for (const c of cells) {
      const before = Math.hypot(c.x - px, c.y - py);
      const v = SPEED * (before < NEAR ? 0.5 : 1) * speedScale * dt;
      c.x += Math.cos(c.a) * v;
      c.y += Math.sin(c.a) * v;
      const after = Math.hypot(c.x - px, c.y - py);
      // Tumble rate drops while the sensed direction is improving. A
      // pointerdown pulse holds every cell on the closing rate regardless of
      // what the last step actually did, so the group commits together.
      const closing = bias > 0 || after < before;
      if (Math.random() < (closing ? TUMBLE_CLOSING : TUMBLE_AWAY) * dt) c.a += (Math.random() - 0.5) * TURN;
      if (c.x < 0) c.x += canvas.width; else if (c.x >= canvas.width) c.x -= canvas.width;
      if (c.y < 0) c.y += canvas.height; else if (c.y >= canvas.height) c.y -= canvas.height;
    }
  };

  const paint = (): void => {
    // The dirty rect is last frame's paint, not this frame's — clearing that
    // erases exactly what is currently on screen, whatever direction the
    // cells moved or wrapped in.
    if (prevBox) ctx.clearRect(prevBox.x0, prevBox.y0, prevBox.x1 - prevBox.x0, prevBox.y1 - prevBox.y0);

    let x0 = px, y0 = py, x1 = px, y1 = py;
    for (const c of cells) {
      if (c.x < x0) x0 = c.x; else if (c.x > x1) x1 = c.x;
      if (c.y < y0) y0 = c.y; else if (c.y > y1) y1 = c.y;
    }
    const pad = CELL * 2;
    prevBox = { x0: x0 - pad, y0: y0 - pad, x1: x1 + pad, y1: y1 + pad };

    for (const c of cells) {
      ctx.fillRect(Math.round(c.x / CELL) * CELL, Math.round(c.y / CELL) * CELL, CELL, CELL);
    }
  };

  const tick = (now: number): void => {
    raf = 0;
    const idle = now - lastMove;
    if (idle > IDLE_AT + IDLE_DECAY) { last = 0; return; }   // idle costs zero frames
    const dt = last ? Math.min(0.05, (now - last) / 1000) : 0.016;
    last = now;
    if (bias > 0) bias = Math.max(0, bias - dt / BIAS_DECAY);
    const speedScale = idle > IDLE_AT ? Math.max(0, 1 - (idle - IDLE_AT) / IDLE_DECAY) : 1;
    step(dt, speedScale);
    paint();
    raf = requestAnimationFrame(tick);
  };

  const start = (): void => {
    if (raf || away || dormant) return;
    last = 0;
    raf = requestAnimationFrame(tick);
  };
  const stop = (): void => {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  };

  const onMove = (e: PointerEvent): void => {
    px = e.clientX; py = e.clientY;
    lastMove = performance.now();
    if (!seeded) seed();
    if (!away) start();
  };

  // Whether the pointer is over the plate is answered by the plate, not by
  // hit-testing the document on every move. elementFromPoint forces a layout,
  // and pointermove is the hottest event there is — paying a synchronous layout
  // on each one, to learn something two listeners already know, is exactly the
  // cost this whole pass exists to remove. On the library page there is no
  // plate, so nothing is bound and the gate is simply inert.
  const setAway = (next: boolean): void => {
    if (next === away) return;
    away = next;
    canvas.classList.toggle('is-away', away);
    if (away) stop(); else start();
  };
  const plate = document.querySelector('.canvas-wrap');
  const onPlateIn = (): void => setAway(true);
  const onPlateOut = (): void => setAway(false);
  plate?.addEventListener('pointerenter', onPlateIn);
  plate?.addEventListener('pointerleave', onPlateOut);
  const onDown = (): void => { if (!away) bias = 1; };
  const onLeave = (): void => stop();

  let resizeT = 0;
  const onResize = (): void => {
    clearTimeout(resizeT);
    resizeT = window.setTimeout(layout, 160);
  };

  addEventListener('pointermove', onMove);
  addEventListener('pointerdown', onDown);
  document.addEventListener('pointerleave', onLeave);
  addEventListener('resize', onResize);

  const teardown = (): void => {
    stop();
    removeEventListener('pointermove', onMove);
    removeEventListener('pointerdown', onDown);
    document.removeEventListener('pointerleave', onLeave);
    removeEventListener('resize', onResize);
    plate?.removeEventListener('pointerenter', onPlateIn);
    plate?.removeEventListener('pointerleave', onPlateOut);
    clearTimeout(resizeT);
    canvas.remove();
  };
  // Dropping to the low tier stops the swarm dead; it does not destroy it. The
  // tier is stepped down automatically when frames are missed, but it is also a
  // control a person can set by hand, and a control you can turn off ought to
  // turn back on. Dormant costs nothing: the loop is stopped and the canvas is
  // hidden, which is the same bill as not existing.
  onTier((t) => {
    dormant = t === 'low';
    if (dormant) { stop(); canvas.hidden = true; }
    else { canvas.hidden = false; if (!away) start(); }
  });

  return teardown;
}
