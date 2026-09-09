/**
 * The embed.
 *
 * Someone else's page, so this file gets none of the lab: no rails, no dock,
 * no tour, no storage, no keyboard. A plate that runs the same simulation from
 * the same `#p=` payload a share link carries, sized to whatever box the host
 * gave the iframe, and nothing else.
 *
 * Two things it must not do on a stranger's site: burn a core while nobody is
 * looking, and move when the visitor has asked the platform for less motion.
 */
import './embed.css';
import { defaults, readURL, type Params } from './params';
import { Sim } from './sim';
import { Renderer } from './render';
import { initPerf, budget, sampleFrame } from './perf';

const P: Params = { ...defaults, ...(readURL() ?? {}) };

// The host decides the box; the plate never reserves anything for chrome that
// is not on this page.
const canvas = document.getElementById('plate') as HTMLCanvasElement;
const renderer = new Renderer(canvas);
const sim = new Sim();

// The tier caps the work, exactly as it does in the lab, and has to be known
// before the first size is chosen.
const b = budget(initPerf());
if (P.capacity > b.cells) P.capacity = b.cells;
if (P.pixelSize < b.pixel) P.pixelSize = b.pixel;

const reduced = matchMedia('(prefers-reduced-motion: reduce)');

const size = (): [number, number] => [
  Math.floor(document.documentElement.clientWidth),
  Math.floor(document.documentElement.clientHeight),
];

let deadAt = 0;
let ready = false;

/**
 * An iframe marked loading="lazy" is laid out only once it is scrolled near, so
 * the first measurement on a host page is routinely 0×0. Culturing a
 * zero-width plate and correcting it later shows as a plate that starts wrong,
 * so the normal path waits for the observer below to report a real box.
 *
 * `force` is the last resort. The plate's context is opaque, which means an
 * unsized canvas is not blank but black, so "wait indefinitely" is not a safe
 * default: a host that never lays this frame out would get a black rectangle
 * for ever. After half a second of no box at all, draw a small one.
 */
function reset(force = false): void {
  let [w, h] = size();
  if (w < 8 || h < 8) {
    if (!force) return;
    [w, h] = [320, 200];
  }
  deadAt = 0;
  ready = true;
  canvas.style.visibility = 'visible';
  document.getElementById('fallback')?.remove();
  renderer.resize(w, h, P.pixelSize);
  sim.reset(w, h, P);
  // A still plate is an empty plate, and an empty plate reads as a broken
  // embed. When motion is refused, grow the culture to something worth looking
  // at and stop there rather than showing the first frame of nothing.
  if (reduced.matches) for (let i = 0; i < 900; i++) sim.step(1 / 30, P);
  renderer.draw(sim, P);
}

/** Re-measure, and start a new culture only if the box actually changed. */
function check(force = false): void {
  const [w, h] = size();
  if (ready && Math.abs(w - renderer.w) < 2 && Math.abs(h - renderer.h) < 2) return;
  reset(force);
}

let resizeTimer = 0;
new ResizeObserver(() => {
  clearTimeout(resizeTimer);
  resizeTimer = window.setTimeout(check, 180);
}).observe(document.documentElement);

// The observer is the good path and usually the only one that fires. These are
// for the frames it does not cover: a document that had no layout at all when
// the module ran, in a host that never resizes it afterwards. One late check
// picks up the real box; the forced one before it guarantees that something is
// on screen in the meantime.
addEventListener('load', () => check());
setTimeout(() => check(true), 600);
setTimeout(() => check(), 2000);

let last = performance.now();

function tick(now: number): void {
  const dt = Math.min(1 / 20, Math.max(1 / 240, (now - last) / 1000));
  last = now;
  // A background tab still gets frames in some browsers, and an embed nobody
  // can see has no business stepping a simulation.
  if (ready && !document.hidden) {
    sampleFrame(dt);
    sim.step(dt, P);
    renderer.draw(sim, P);
    // Left on someone's page for an afternoon, every culture reaches death
    // phase and empties the plate. An embed that has been dead since lunchtime
    // reads as a broken image, so the last of it gets a few seconds to be seen
    // and then the plate is seeded again — a new seed, so it is a new culture
    // and not a loop.
    if (sim.phase === 'extinct') {
      if (!deadAt) deadAt = now;
      else if (now - deadAt > 6000) { P.seed = (P.seed + 1) | 0; reset(); }
    }
  }
  requestAnimationFrame(tick);
}

reset();
// Under reduced motion the plate is a single still frame, so no loop is
// started at all. Scheduling a frame callback for ever in order to decide not
// to draw is precisely the idle cost this file exists to avoid.
if (!reduced.matches) requestAnimationFrame(tick);
