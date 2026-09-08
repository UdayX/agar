/**
 * Performance tier.
 *
 * The plate is a per-pixel simulation and the page has three live canvases on
 * it, so a weak machine has to be given a smaller job rather than a slower one.
 * This decides how big that job is, once from what the browser will admit to,
 * and then continuously from measured frame time.
 *
 * The tier is published as `data-perf` on <html>, so CSS can drop the ambient
 * animations without any of the modules knowing about each other.
 */
export type Tier = 'high' | 'balanced' | 'low';

const KEY = 'agar.perf';

let tier: Tier = 'balanced';
let pinned = false;                     // user chose; stop auto-adjusting
const listeners = new Set<(t: Tier) => void>();

/** What the browser will tell us before a single frame has been drawn. */
function guess(): Tier {
  const cores = navigator.hardwareConcurrency ?? 4;
  const mem = (navigator as { deviceMemory?: number }).deviceMemory ?? 4;
  const coarse = matchMedia('(pointer: coarse)').matches;
  const saveData = (navigator as { connection?: { saveData?: boolean } }).connection?.saveData;

  if (saveData || cores <= 2 || mem <= 2) return 'low';
  // A phone is not a small desktop: it is thermally limited, so it gets the
  // middle tier at best however many cores it reports.
  if (coarse) return cores >= 8 && mem >= 6 ? 'balanced' : 'low';
  if (cores >= 8 && mem >= 8) return 'high';
  return 'balanced';
}

function publish(): void {
  document.documentElement.dataset.perf = tier;
  for (const fn of listeners) fn(tier);
}

export function initPerf(): Tier {
  let stored: string | null = null;
  try { stored = localStorage.getItem(KEY); } catch { /* private mode */ }
  if (stored === 'high' || stored === 'balanced' || stored === 'low') {
    tier = stored; pinned = true;
  } else {
    tier = guess();
  }
  publish();
  return tier;
}

export function setTier(next: Tier, byUser = true): void {
  if (next === tier && pinned === byUser) return;
  tier = next;
  if (byUser) {
    pinned = true;
    try { localStorage.setItem(KEY, next); } catch { /* ignore */ }
  }
  publish();
}

export function onTier(fn: (t: Tier) => void): void { listeners.add(fn); }

/**
 * Continuous check. Feed it the frame time; if the page cannot hold 30 fps for
 * a couple of seconds it steps down one tier, once, and stops watching. It
 * never steps back up on its own — a machine that recovers because the user
 * closed something else should not start stuttering again to find out.
 */
let slow = 0;
let watching = true;
export function sampleFrame(dt: number): void {
  if (!watching || pinned) return;
  if (dt > 1 / 28) slow++; else slow = Math.max(0, slow - 1);
  if (slow > 90) {
    watching = false;
    if (tier === 'high') setTier('balanced', false);
    else if (tier === 'balanced') setTier('low', false);
  }
}

/** Simulation ceilings per tier. The plate stays honest; it just stays smaller. */
export const budget = (t: Tier): { cells: number; pixel: number; dpr: number } =>
  t === 'high' ? { cells: 9000, pixel: 1, dpr: 2 }
  : t === 'balanced' ? { cells: 5000, pixel: 2, dpr: 1.5 }
  : { cells: 2200, pixel: 3, dpr: 1 };
