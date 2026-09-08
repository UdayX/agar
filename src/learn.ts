/**
 * The Learn page.
 *
 * A library of nine organisms. Every card carries a still of its form, made at
 * load from the same renderer that animates it; hovering or focusing a card
 * hands that card the one live WebGL context on the page, and opening a card
 * hands it to the detail view instead.
 *
 * One context, moved around, is the whole performance story here. Nine live
 * canvases would exhaust the browser's context budget on any machine and cook a
 * laptop on most.
 */
import './style.css';
import { LORE, loreById, type Lore } from './organisms';
import { createViewer, type Viewer } from './organism3d';
import { hexToRGB } from './render';
import { defaults } from './params';
import { initPerf, onTier } from './perf';
import logoUrl from './AgarLogo.svg';

const tier = initPerf();
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

// Arriving on a sub-page is still an arrival. Claim the lab's boot flag so the
// five-second culture sequence does not replay on top of a page transition
// when someone crosses back over. (The key belongs to loader.ts; importing it
// would drag the dither pipeline and the boot logo into this bundle for one
// string.)
try { sessionStorage.setItem('agar.booted', '1'); } catch { /* private mode */ }

const logo = document.getElementById('logo') as HTMLImageElement | null;
if (logo) logo.src = logoUrl;

const lib = document.getElementById('library')!;
const detail = document.getElementById('detail')!;

// ── the single live renderer ────────────────────────────────────────────
const glCanvas = document.createElement('canvas');
glCanvas.className = 'viz';
glCanvas.setAttribute('aria-hidden', 'true');

const viewer: Viewer = createViewer(glCanvas, {
  ink: hexToRGB(defaults.inkColor),
  paper: hexToRGB(defaults.paperColor),
  acid: hexToRGB(defaults.acidColor),
});
viewer.quality(tier);
viewer.spin(!reduced);
onTier((t) => viewer.quality(t));

const THUMB = tier === 'low' ? 168 : 208;

// ── cards ───────────────────────────────────────────────────────────────
const cards = new Map<string, HTMLElement>();

for (const l of LORE) {
  const card = document.createElement('article');
  card.className = 'org-card';
  card.id = `card-${l.id}`;
  card.innerHTML = `
    <button class="org-open" type="button" aria-describedby="lede-${l.id}">
      <span class="visually-hidden">Open</span> ${l.name}
    </button>
    <div class="org-stage" data-slot="${l.id}">
      <canvas class="org-thumb" aria-hidden="true"></canvas>
      <span class="org-turn" aria-hidden="true">Drag to turn</span>
    </div>
    <div class="org-meta">
      <h2 class="org-name">${l.name}</h2>
      <p class="org-latin">${l.latin}</p>
      <p class="org-lede" id="lede-${l.id}">${l.lede}</p>
    </div>`;
  lib.appendChild(card);
  cards.set(l.id, card);
}

// ── stills ──────────────────────────────────────────────────────────────
// Render each form once into its card. drawImage has to happen in the same
// task as the WebGL draw, or the drawing buffer is already cleared.
let stillsDone = false;
function makeStills(): void {
  if (stillsDone) return;
  stillsDone = true;
  for (const l of LORE) {
    const card = cards.get(l.id)!;
    const thumb = card.querySelector('.org-thumb') as HTMLCanvasElement;
    viewer.size(THUMB, THUMB);
    viewer.show(l.form);
    thumb.width = viewer.el.width;
    thumb.height = viewer.el.height;
    thumb.getContext('2d')?.drawImage(viewer.el, 0, 0);
  }
}
// Straight away, not on a frame callback and not gated on visibility: a page
// opened in a background tab gets no frames, and the library would then be
// nine empty squares for as long as it stayed in the background. Nine draws at
// a seventieth of a megapixel each is not worth deferring.
makeStills();


// ── hover / focus hands the card the live renderer ──────────────────────
let liveOn: string | null = null;
const canHover = matchMedia('(hover: hover) and (pointer: fine)').matches;

function goLive(id: string): void {
  if (liveOn === id || detailOpen) return;
  const card = cards.get(id);
  const stage = card?.querySelector('.org-stage') as HTMLElement | undefined;
  if (!stage) return;
  liveOn = id;
  stage.appendChild(viewer.el);
  viewer.size(THUMB, THUMB);
  viewer.show(loreById(id)!.form);
  viewer.zoom(1.16);
  if (!reduced) viewer.start();
}

function goStill(): void {
  if (!liveOn || detailOpen) return;
  liveOn = null;
  viewer.stop();
  viewer.zoom(1);
  viewer.el.remove();
}

if (canHover) {
  for (const [id, card] of cards) {
    card.addEventListener('pointerenter', () => goLive(id));
    card.addEventListener('pointerleave', goStill);
    card.addEventListener('focusin', () => goLive(id));
    card.addEventListener('focusout', (e) => {
      if (!card.contains(e.relatedTarget as Node)) goStill();
    });
  }
}

// ── detail ──────────────────────────────────────────────────────────────
let detailOpen = false;
let lastFocus: HTMLElement | null = null;

function fill(l: Lore): string {
  return `
    <div class="od-scrim" data-close></div>
    <article class="od-panel" role="dialog" aria-modal="true" aria-labelledby="od-name" tabindex="-1">
      <header class="od-head">
        <p class="od-domain">${l.domain}</p>
        <button class="btn small ghost" type="button" data-close aria-label="Close">Close</button>
      </header>

      <div class="od-stage" id="od-stage">
        <p class="od-hint" aria-hidden="true">Drag to turn · scroll on to zoom</p>
      </div>

      <div class="od-read">
        <h2 class="od-name" id="od-name">${l.name}</h2>
        <p class="od-latin">${l.latin}</p>
        <p class="od-lede">${l.lede}</p>

        <div class="od-body">
          <p>${l.body[0]}</p>
          <p>${l.body[1]}</p>
        </div>

        <h3 class="od-h">Properties</h3>
        <dl class="od-props">
          ${l.props.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('')}
        </dl>

        <h3 class="od-h">Behaviour and record</h3>
        <ul class="od-facts">${l.facts.map((f) => `<li>${f}</li>`).join('')}</ul>

        <h3 class="od-h">In the world</h3>
        <p class="od-world">${l.world}</p>

        <p class="od-source">${l.source}</p>

        <div class="od-actions">
          <a class="btn primary" href="./?species=${l.id}">Culture this organism</a>
          <button class="btn" type="button" data-step="-1">Previous</button>
          <button class="btn" type="button" data-step="1">Next organism</button>
        </div>
      </div>
    </article>`;
}

function openDetail(id: string, push = true): void {
  const l = loreById(id);
  if (!l) return;
  if (!detailOpen) lastFocus = document.activeElement as HTMLElement;

  detailOpen = true;
  liveOn = null;
  detail.innerHTML = fill(l);
  detail.hidden = false;
  document.body.classList.add('is-locked');

  const stage = document.getElementById('od-stage')!;
  stage.appendChild(viewer.el);
  sizeDetail();
  viewer.show(l.form);
  viewer.zoom(1);
  if (!reduced) viewer.start();

  (detail.querySelector('.od-panel') as HTMLElement).focus();
  if (push && location.hash !== `#${id}`) history.pushState({ id }, '', `#${id}`);
  void detail.offsetWidth;                 // flush, so the entry transition runs
  detail.classList.add('is-in');
}

function sizeDetail(): void {
  const stage = document.getElementById('od-stage');
  if (!stage) return;
  const r = stage.getBoundingClientRect();
  const s = Math.max(200, Math.min(r.width, r.height));
  viewer.size(Math.round(s), Math.round(s));
}

function closeDetail(push = true): void {
  if (!detailOpen) return;
  detailOpen = false;
  viewer.stop();
  viewer.el.remove();
  detail.classList.remove('is-in');
  detail.hidden = true;
  detail.innerHTML = '';
  document.body.classList.remove('is-locked');
  if (push && location.hash) history.pushState(null, '', location.pathname);
  lastFocus?.focus();
}

lib.addEventListener('click', (e) => {
  const card = (e.target as HTMLElement).closest('.org-card') as HTMLElement | null;
  if (card) openDetail(card.id.replace('card-', ''));
});

detail.addEventListener('click', (e) => {
  const t = e.target as HTMLElement;
  if (t.closest('[data-close]')) { closeDetail(); return; }
  const step = t.closest('[data-step]')?.getAttribute('data-step');
  if (step) {
    const cur = LORE.findIndex((l) => `#${l.id}` === location.hash);
    const next = (cur + Number(step) + LORE.length) % LORE.length;
    openDetail(LORE[next].id);
  }
});

// Scrolling over the stage zooms rather than scrolling the page behind it.
let zoom = 1;
detail.addEventListener('wheel', (e) => {
  if (!(e.target as HTMLElement).closest('.od-stage')) return;
  e.preventDefault();
  zoom = Math.max(0.65, Math.min(2.6, zoom * (e.deltaY > 0 ? 0.92 : 1.087)));
  viewer.zoom(zoom);
}, { passive: false });

addEventListener('keydown', (e) => {
  if (!detailOpen) return;
  if (e.key === 'Escape') { e.preventDefault(); closeDetail(); }
});

addEventListener('popstate', () => {
  const id = location.hash.slice(1);
  if (id && loreById(id)) openDetail(id, false);
  else closeDetail(false);
});

addEventListener('resize', () => { if (detailOpen) sizeDetail(); });

// Deep link straight into an organism.
{
  const id = location.hash.slice(1);
  if (id && loreById(id)) requestAnimationFrame(() => openDetail(id, false));
}

// Off-screen costs nothing: the library scrolls past the fold on every screen.
const io = new IntersectionObserver((entries) => {
  for (const e of entries) {
    if (!e.isIntersecting && !detailOpen) { viewer.stop(); goStill(); }
  }
}, { threshold: 0 });
io.observe(lib);
