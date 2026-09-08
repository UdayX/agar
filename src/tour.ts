/**
 * The walkthrough.
 *
 * Anchored coach marks, not a modal carousel: the plate has to stay visible and
 * running while it is being explained, because what it is doing is the thing
 * being explained. The spotlight is a transparent box with an enormous shadow,
 * which is the only way to punch a hole in an overlay that still lets the
 * element underneath be seen and clicked.
 *
 * It runs once, on a first visit, and can be replayed from the header for ever
 * after. Anything a person can be shown twice must be dismissible in one key.
 */
export interface Step {
  /** Element to spotlight. Missing elements are skipped, not fatal. */
  target: string;
  title: string;
  body: string;
  /** Preferred side; it flips if there is no room. */
  side?: 'top' | 'bottom' | 'left' | 'right';
  /** Put the interface into the state this step describes. */
  before?: () => void;
}

const SEEN = 'agar.tour.v1';
const PAD = 8;

export function tourSeen(): boolean {
  try { return localStorage.getItem(SEEN) === '1'; } catch { return true; }
}

export function runTour(steps: Step[], onEnd?: () => void): void {
  const live = steps.filter((s) => document.getElementById(s.target));
  if (!live.length) return;

  const root = document.createElement('div');
  root.className = 'tour';
  root.innerHTML = `
    <div class="tour-spot" aria-hidden="true"></div>
    <div class="tour-card" role="dialog" aria-modal="false" aria-labelledby="tour-title" tabindex="-1">
      <p class="tour-step"></p>
      <h2 class="tour-h" id="tour-title"></h2>
      <p class="tour-body"></p>
      <div class="tour-actions">
        <button class="btn small ghost" type="button" data-act="end">Skip</button>
        <div class="tour-nav">
          <button class="btn small" type="button" data-act="back">Back</button>
          <button class="btn small primary" type="button" data-act="next">Next</button>
        </div>
      </div>
    </div>`;
  document.body.appendChild(root);

  const spot = root.querySelector('.tour-spot') as HTMLElement;
  const card = root.querySelector('.tour-card') as HTMLElement;
  const elStep = root.querySelector('.tour-step') as HTMLElement;
  const elTitle = root.querySelector('.tour-h') as HTMLElement;
  const elBody = root.querySelector('.tour-body') as HTMLElement;
  const btnBack = root.querySelector('[data-act="back"]') as HTMLButtonElement;
  const btnNext = root.querySelector('[data-act="next"]') as HTMLButtonElement;

  let i = 0;

  const place = (): void => {
    const s = live[i];
    const el = document.getElementById(s.target);
    if (!el) { end(); return; }

    const r = el.getBoundingClientRect();
    spot.style.left = `${r.left - PAD}px`;
    spot.style.top = `${r.top - PAD}px`;
    spot.style.width = `${r.width + PAD * 2}px`;
    spot.style.height = `${r.height + PAD * 2}px`;

    const cw = card.offsetWidth || 300;
    const ch = card.offsetHeight || 160;
    const gap = 16;
    const vw = innerWidth, vh = innerHeight;

    let side = s.side ?? 'bottom';
    if (side === 'bottom' && r.bottom + gap + ch > vh) side = 'top';
    if (side === 'top' && r.top - gap - ch < 0) side = 'bottom';
    if (side === 'right' && r.right + gap + cw > vw) side = 'left';
    if (side === 'left' && r.left - gap - cw < 0) side = 'right';

    let x: number, y: number;
    if (side === 'bottom') { x = r.left; y = r.bottom + gap; }
    else if (side === 'top') { x = r.left; y = r.top - gap - ch; }
    else if (side === 'right') { x = r.right + gap; y = r.top; }
    else { x = r.left - gap - cw; y = r.top; }

    card.style.left = `${Math.max(12, Math.min(vw - cw - 12, x))}px`;
    card.style.top = `${Math.max(12, Math.min(vh - ch - 12, y))}px`;
  };

  const show = (): void => {
    const s = live[i];
    s.before?.();
    const el = document.getElementById(s.target);
    el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    elStep.textContent = `Step ${i + 1} of ${live.length}`;
    elTitle.textContent = s.title;
    elBody.textContent = s.body;
    btnBack.disabled = i === 0;
    btnNext.textContent = i === live.length - 1 ? 'Start culturing' : 'Next';
    // The element may still be settling from before(), so measure now and again
    // once the layout it triggered has run. Not on requestAnimationFrame: a tab
    // in the background gets no frames, and the card would never be positioned.
    place();
    setTimeout(place, 0);
    setTimeout(place, 140);
    card.focus();
  };

  const end = (): void => {
    try { localStorage.setItem(SEEN, '1'); } catch { /* ignore */ }
    removeEventListener('keydown', onKey, true);
    removeEventListener('resize', place);
    removeEventListener('scroll', place, true);
    root.classList.add('is-out');
    setTimeout(() => root.remove(), 220);
    onEnd?.();
  };

  const go = (d: number): void => {
    const next = i + d;
    if (next < 0) return;
    if (next >= live.length) { end(); return; }
    i = next; show();
  };

  const onKey = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') { e.preventDefault(); end(); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); go(1); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); go(-1); }
  };

  root.addEventListener('click', (e) => {
    const act = (e.target as HTMLElement).closest('[data-act]')?.getAttribute('data-act');
    if (act === 'end') end();
    else if (act === 'next') go(1);
    else if (act === 'back') go(-1);
  });
  addEventListener('keydown', onKey, true);
  addEventListener('resize', place);
  addEventListener('scroll', place, true);

  // Forcing layout is what makes the entry transition run; a frame callback
  // would do the same and would also never fire in a background tab.
  void root.offsetWidth;
  root.classList.add('is-in');
  show();
}
