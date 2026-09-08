/** AGAR — wiring. */
import './style.css';
import { defaults, PRESETS, SPECIES, speciesById, type Mode, type Params } from './params';
import { Sim, DEAD } from './sim';
import { Renderer, hexToRGB } from './render';
import { buildControls, buildOrganisms, buildPresets, buildReadout, buildThemes, buildTools, buildMilestones, renderLog } from './ui';
import { Slider } from './slider';
import { drawGrowth, drawTraits } from './charts';
import * as X from './export';
import { importFont, clearImportedFont, hasImportedFont, importedFontName } from './glyph';
import { runBoot } from './loader';
import { runFooter } from './footer';
import { runTour, tourSeen, type Step } from './tour';
import { initPerf, budget, onTier, sampleFrame, setTier, type Tier } from './perf';
import logoUrl from './AgarLogo.svg';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const P: Params = { ...defaults, ...(X.readURL() ?? {}) };

const canvas = $<HTMLCanvasElement>('plate');
const renderer = new Renderer(canvas);
const sim = new Sim();
const recorder = new X.Recorder();
const announce = $('announce');
const probe = $('probe');

const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
let running = false;
let lifespanRun = false;
let activePreset = 'default';
let lastPhase = '';

const STRUCTURAL = new Set<keyof Params>([
  'mode', 'text', 'fontSize', 'fontWeight', 'tracking', 'lineHeight',
  'inoculum', 'seedDensity', 'species', 'seed', 'substrate',
  'dishRichness', 'colonies',
]);

const TOOL_HINT: Record<string, string> = {
  inspect: 'Hover a cell to read its genome and state.',
  feed: 'Drag on the plate to paint nutrient. Motile cells will find it.',
  toxin: 'Drag to paint antibiotic. Cells below their inherited MIC die; the rest flee the gradient.',
  light: 'Click to drop a beacon. It feeds photoautotrophs and warms the plate around it — a thermophile will only grow in the halo, and a mesophile will cook under one.',
  inoculate: 'Drag to add cells of the selected organism.',
  scrape: 'Drag to scrape cells off the plate.',
};

const say = (msg: string): void => { announce.textContent = msg; };

const SPECIES_IDS = new Set(SPECIES.map((x) => x.id));

// ── layout ───────────────────────────────────────────────────────────────
function plateSize(): [number, number] {
  // clientHeight includes padding, and the wrap reserves room at the bottom for
  // the floating dock — read the real padding rather than assuming it.
  const wrap = canvas.parentElement as HTMLElement;
  const cs = getComputedStyle(wrap);
  const px = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);
  const py = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
  // The floors only guard against a degenerate plate during layout thrash. They
  // must stay below what the narrowest breakpoint actually offers, or the plate
  // is forced taller than its box and slides under the dock.
  const w = Math.max(200, Math.floor(wrap.clientWidth - px));
  const h = Math.max(140, Math.floor(wrap.clientHeight - py));
  return [w, h];
}

function resetSim(): void {
  const [w, h] = plateSize();
  renderer.resize(w, h, P.pixelSize);
  sim.reset(w, h, P);
  lastPhase = '';
  draw();
  updateAll();
}

let resizeTimer = 0;
new ResizeObserver(() => {
  clearTimeout(resizeTimer);
  resizeTimer = window.setTimeout(() => {
    const [w, h] = plateSize();
    if (Math.abs(w - renderer.w) < 2 && Math.abs(h - renderer.h) < 2) return;
    resetSim();
  }, 180);
}).observe(canvas.parentElement as HTMLElement);

// ── palette drives the interface accent too ──────────────────────────────
function applyAccent(): void {
  document.documentElement.style.setProperty('--acid', P.acidColor);
}

// ── controls ─────────────────────────────────────────────────────────────
function applySpecies(id: string): void {
  const s = speciesById(id);
  P.species = id;
  P.doubling = s.doubling; P.ks = s.ks; P.maintenance = s.maintenance;
  P.adhesion = s.adhesion; P.alignment = s.alignment; P.hayflick = s.hayflick;
  P.lifespan = s.lifespan; P.runLength = 1;
  P.asymmetry = s.shape === 'bud' ? 0.85 : 0;
  $('org-note').textContent = s.note;
}

// Which tab each parameter group lives under. The schema groups by subject
// matter; the interface groups by what a person is trying to change, and those
// are not the same cut. Everything unclaimed falls to Medium, which is the
// plate itself.
const TAB_OF: Record<string, 'organism' | 'medium' | 'look'> = {
  Organism: 'organism', Metabolism: 'organism', Reproduction: 'organism', Mutation: 'organism',
  Specimen: 'medium', Dish: 'medium', Environment: 'medium', Time: 'medium',
  Optics: 'look',
};

const hostFor = (group: string, level: 'basic' | 'advanced'): HTMLElement =>
  $(`${level === 'basic' ? 'basics' : 'adv'}-${TAB_OF[group] ?? 'medium'}`);

const panel = buildControls(hostFor, P, (key, value) => {
  (P as Record<string, unknown>)[key] = value;
  if (key === 'species') applySpecies(String(value));
  if (key === 'acidColor') applyAccent();
  if (key === 'pixelSize') renderer.resize(renderer.w, renderer.h, P.pixelSize);
  if (key === 'timeScale') { rate.set(P.timeScale); rateOut.textContent = `${P.timeScale} min/s`; }
  if (key === 'drugDose') sim.drug = Math.max(sim.drug, Number(value));
  if (STRUCTURAL.has(key)) resetSim();
  else if (!running) draw();
});

const syncOrganisms = buildOrganisms($('organisms'), P, (id) => {
  applySpecies(id);
  panel.sync();
  resetSim();
  say(`${speciesById(id).label}. ${speciesById(id).note}`);
});

const syncTools = buildTools($('tools'), P, (id) => {
  P.tool = id as Params['tool'];
  renderer.cursor.tool = id;
  $('tool-hint').textContent = TOOL_HINT[id] ?? '';
  canvas.classList.toggle('painting', id !== 'inspect');
  if (id !== 'inspect') probe.hidden = true;
  if (!running) draw();
});

buildThemes($('themes'), (t) => {
  P.paperColor = t.paper; P.inkColor = t.ink; P.acidColor = t.acid;
  applyAccent(); panel.sync(); draw();
  say(`Colour scheme: ${t.label}.`);
});

const syncPresets = buildPresets($('presets'), (id) => {
  const preset = PRESETS.find((x) => x.id === id);
  if (!preset) return;
  const colours = { paperColor: P.paperColor, inkColor: P.inkColor, acidColor: P.acidColor };
  Object.assign(P, defaults, colours);
  applySpecies(preset.patch.species ?? defaults.species);
  Object.assign(P, preset.patch);
  activePreset = id;
  syncPresets(activePreset);
  syncOrganisms(P.species);
  syncTools(P.tool);
  setMode(P.mode, false);
  panel.sync();
  syncSpecimen();
  rate.set(P.timeScale);
  rateOut.textContent = `${P.timeScale} min/s`;
  resetSim();
  say(`${preset.label} loaded. ${preset.note}`);
});
syncPresets(activePreset);
const syncMilestones = buildMilestones($('milestones'));

const setReadout = buildReadout($('readout'), [
  { key: 'phase', label: 'Phase', hot: true },
  { key: 'time', label: 'Culture age' },
  { key: 'pop', label: 'Population' },
  { key: 'gen', label: 'Generation' },
  { key: 'sub', label: 'Substrate' },
  { key: 'died', label: 'Lysed' },
  { key: 'spore', label: 'Spores' },
  { key: 'sen', label: 'Senescent' },
  { key: 'drug', label: 'Drug' },
  { key: 'res', label: 'Mean MIC' },
  { key: 'org', label: 'Organelles' },
  { key: 'fps', label: 'Frames/s' },
]);

// ── mode ─────────────────────────────────────────────────────────────────
function setMode(m: Mode, rebuild = true): void {
  P.mode = m;
  panel.setMode(m);
  $('block-font').hidden = m !== 'specimen';
  $('specimen-bar').hidden = m !== 'specimen';
  $('mode-note').textContent = m === 'dish'
    ? 'An open plate. Seed it, feed it, and leave it to grow.'
    : 'Letterforms are the growth medium.';
  for (const r of document.querySelectorAll<HTMLInputElement>('input[name="mode"]')) r.checked = r.value === m;
  if (rebuild) resetSim();
}
for (const r of document.querySelectorAll<HTMLInputElement>('input[name="mode"]')) {
  r.addEventListener('change', () => { if (r.checked) { setMode(r.value as Mode); say($('mode-note').textContent ?? ''); } });
}

// ── specimen field ───────────────────────────────────────────────────────
// The text is the one parameter whose effect you can read directly off the
// plate, so it sits above the plate rather than in the rail. It is a textarea
// only so that Return can add a line; it is sized to its content and never
// scrolls, so it still reads as a single field.
const specimen = $<HTMLTextAreaElement>('specimen-text');

function fitSpecimen(): void {
  specimen.style.height = 'auto';
  specimen.style.height = `${Math.min(112, specimen.scrollHeight)}px`;
}

/** Push P.text into the field — after a preset, a shared link or a reset. */
function syncSpecimen(): void {
  if (specimen.value !== P.text) specimen.value = P.text;
  fitSpecimen();
}

let specimenTimer = 0;
specimen.addEventListener('input', () => {
  fitSpecimen();
  P.text = specimen.value;
  // Rebuilding the culture on every keystroke would throw away the colony
  // mid-word. Coalesce to the pause after typing instead.
  clearTimeout(specimenTimer);
  specimenTimer = window.setTimeout(() => resetSim(), 260);
});
syncSpecimen();

// ── transport ────────────────────────────────────────────────────────────
const btnPlay = $<HTMLButtonElement>('btn-play');
const btnLife = $<HTMLButtonElement>('btn-lifespan');
const rateOut = $<HTMLOutputElement>('rate-out');

const rate = new Slider({
  min: 1, max: 400, step: 1, value: P.timeScale,
  labelId: 'rate-label',
  format: (v) => `${v} simulated minutes per second`,
  onInput: (v) => { P.timeScale = v; rateOut.textContent = `${v} min/s`; panel.sync(); },
});
$('rate-slot').appendChild(rate.el);

const brush = new Slider({
  min: 8, max: 140, step: 1, value: P.brush,
  labelId: 'brush-label',
  format: (v) => `${v} pixel brush`,
  onInput: (v) => { P.brush = v; renderer.cursor.r = v; if (!running) draw(); },
});
$('brush-slot').appendChild(brush.el);

function setRunning(on: boolean): void {
  running = on;
  btnPlay.textContent = on ? 'Pause' : 'Incubate';
  btnPlay.setAttribute('aria-pressed', String(on));
  const live = $('live');
  live.dataset.on = String(on);
  (live.querySelector('.live-txt') as HTMLElement).textContent = on ? 'Incubating' : 'Idle';
  if (!on && lifespanRun) endLifespan('paused');
}

btnPlay.addEventListener('click', () => setRunning(!running));
$('btn-step').addEventListener('click', () => { sim.step(1 / 30, P); draw(); updateAll(); });
$('btn-reset').addEventListener('click', () => { resetSim(); say('Culture reset.'); });
$('btn-reseed').addEventListener('click', () => {
  P.seed = Math.floor(Math.random() * 99999999);
  panel.sync(); resetSim(); say(`New seed ${P.seed}.`);
});
$('btn-pulse').addEventListener('click', () => {
  P.drugDose = Math.max(P.drugDose, 1.2);
  sim.drug = Math.max(sim.drug, 1.2);
  panel.sync();
  sim.log.push({ t: sim.t, kind: 'phase', text: 'antibiotic pulse · 1.2 MIC units across the whole plate' });
  say('Antibiotic pulse administered. Sensitive cells will lyse; resistant lineages survive.');
});
$('btn-clear-light').addEventListener('click', () => { sim.clearBeacons(); if (!running) draw(); say('Beacons cleared.'); });

btnLife.addEventListener('click', () => (lifespanRun ? endLifespan('stopped') : startLifespan()));

let lifeStartedAt = 0;
function startLifespan(): void {
  resetSim();
  lifespanRun = true;
  lifeStartedAt = performance.now();
  P.timeScale = Math.max(P.timeScale, 220);
  rate.set(P.timeScale);
  rateOut.textContent = `${P.timeScale} min/s`;
  panel.sync();
  btnLife.setAttribute('aria-pressed', 'true');
  btnLife.textContent = 'Stop lifespan';
  setRunning(true);
  say('Running the full lifespan: lag, exponential, stationary, death.');
}

function endLifespan(reason: string): void {
  if (!lifespanRun) return;
  lifespanRun = false;
  btnLife.setAttribute('aria-pressed', 'false');
  btnLife.textContent = 'Run full lifespan';
  const s = sim.stats();
  sim.log.push({ t: sim.t, kind: 'phase', text: `lifespan run ${reason} · peak N=${sim.peakPop} · ${s.born} born · ${s.died} lysed` });
  say(`Lifespan run ${reason}. Peak population ${sim.peakPop} at ${(sim.t / 60).toFixed(1)} culture hours, ${s.born} born, ${s.died} lysed.`);
  if (reason !== 'paused') setRunning(false);
}

// ── the plate is the instrument: pointer tools ───────────────────────────
let painting = false;
let lastPt: [number, number] | null = null;

function toPlate(e: PointerEvent): [number, number] {
  const r = canvas.getBoundingClientRect();
  return [((e.clientX - r.left) / r.width) * renderer.w, ((e.clientY - r.top) / r.height) * renderer.h];
}

function apply(x: number, y: number): void {
  if (P.tool === 'inspect' || P.tool === 'light') return;
  sim.paint(x, y, P.brush, P.tool, P);
}

canvas.addEventListener('pointerdown', (e) => {
  const [x, y] = toPlate(e);
  renderer.cursor.x = x; renderer.cursor.y = y; renderer.cursor.on = true;
  if (P.tool === 'light') { sim.placeBeacon(x, y); if (!running) draw(); return; }
  if (P.tool === 'inspect') return;
  canvas.setPointerCapture(e.pointerId);
  painting = true;
  lastPt = [x, y];
  apply(x, y);
  if (!running) draw();
  e.preventDefault();
});

canvas.addEventListener('pointermove', (e) => {
  const [x, y] = toPlate(e);
  renderer.cursor.x = x; renderer.cursor.y = y; renderer.cursor.on = true;
  if (painting) {
    // Interpolate along the stroke so a fast drag paints a line, not dots.
    if (lastPt) {
      const [px, py] = lastPt;
      const d = Math.hypot(x - px, y - py);
      const steps = Math.min(24, Math.floor(d / (P.brush * 0.4)));
      for (let i = 1; i <= steps; i++) apply(px + ((x - px) * i) / steps, py + ((y - py) * i) / steps);
    }
    apply(x, y);
    lastPt = [x, y];
  } else if (P.tool === 'inspect') {
    showProbe(e, x, y);
  }
  if (!running) draw();
});

for (const ev of ['pointerup', 'pointercancel'] as const) {
  canvas.addEventListener(ev, (e) => {
    painting = false; lastPt = null;
    canvas.releasePointerCapture?.((e as PointerEvent).pointerId);
  });
}
canvas.addEventListener('pointerleave', () => { renderer.cursor.on = false; probe.hidden = true; });

// The brush is the one setting you adjust without looking away from the plate,
// so it is on the wheel as well as on its slider. preventDefault only once the
// gesture is clearly a brush change, or the page stops scrolling past the tool.
canvas.addEventListener('wheel', (e) => {
  if (P.tool === 'inspect') return;
  e.preventDefault();
  setBrush(P.brush * (e.deltaY > 0 ? 0.92 : 1.087));
}, { passive: false });

function setBrush(v: number): void {
  P.brush = Math.round(Math.max(8, Math.min(140, v)));
  brush.set(P.brush);
  renderer.cursor.r = P.brush;
  canvas.parentElement?.classList.add('show-brush');
  clearTimeout(brushFlash);
  brushFlash = window.setTimeout(() => canvas.parentElement?.classList.remove('show-brush'), 900);
  if (!running) draw();
}
let brushFlash = 0;

function showProbe(e: PointerEvent, x: number, y: number): void {
  const c = sim.pick(x, y, 16);
  if (!c) { probe.hidden = true; return; }
  const heat = sim.heatAt(c.x, c.y);
  const state = c.state === DEAD ? 'lysed' : c.state === 1 ? 'senescent' : c.state === 3 ? 'spore' : 'alive';
  probe.textContent =
    `cell #${c.id} · ${state}\n` +
    `generation ${c.gen} · ${c.divisions} divisions\n` +
    `age ${(c.age / 60).toFixed(1)} h · size ${c.size.toFixed(2)}\n` +
    `growth ${(c.mu * 100).toFixed(0)}% of max\n` +
    `MIC ${c.g.resistance.toFixed(2)} · speed ×${c.g.speed.toFixed(2)}\n` +
    `organelles ${c.organelles}` +
    // Only worth a line when a beacon is actually changing it — otherwise this
    // is the incubator setting, which is already on a slider.
    (heat >= 0.5 ? `\nlocal ${(P.temperature + heat).toFixed(0)} °C (+${heat.toFixed(0)} from beacons)` : '');
  const wrap = canvas.parentElement as HTMLElement;
  const wr = wrap.getBoundingClientRect();
  probe.hidden = false;
  probe.style.left = `${Math.min(wr.width - 250, e.clientX - wr.left + 14)}px`;
  probe.style.top = `${Math.min(wr.height - 130, e.clientY - wr.top + 14)}px`;
}

// ── font import ──────────────────────────────────────────────────────────
const fontStatus = $('font-status');
const fontClear = $<HTMLButtonElement>('font-clear');
const drop = $('font-drop');

async function loadFont(file: File): Promise<void> {
  try {
    const name = await importFont(file);
    fontStatus.textContent = `Culturing “${name}”. The file never leaves your machine.`;
    fontClear.disabled = false;
    resetSim();
    say(`Typeface ${name} imported.`);
  } catch {
    fontStatus.textContent = 'That file could not be decoded as a font. Try .ttf, .otf, .woff or .woff2.';
    say('Font import failed.');
  }
}

$<HTMLInputElement>('font-file').addEventListener('change', (e) => {
  const f = (e.target as HTMLInputElement).files?.[0];
  if (f) loadFont(f);
});
fontClear.addEventListener('click', () => {
  clearImportedFont();
  fontClear.disabled = true;
  fontStatus.textContent = 'Using the system monospace face.';
  resetSim();
});
for (const ev of ['dragenter', 'dragover'] as const) {
  drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('over'); });
}
for (const ev of ['dragleave', 'drop'] as const) {
  drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove('over'); });
}
drop.addEventListener('drop', (e) => {
  const f = (e as DragEvent).dataTransfer?.files?.[0];
  if (f) loadFont(f);
});

// ── export ───────────────────────────────────────────────────────────────
const name = () => `agar-${P.species}-${X.stamp()}`;
$('ex-png1').addEventListener('click', () => X.exportPNG(canvas, 1, name()));
$('ex-png2').addEventListener('click', () => X.exportPNG(canvas, 2, name()));
$('ex-png4').addEventListener('click', () => X.exportPNG(canvas, 4, name()));
$('ex-svg').addEventListener('click', () => X.exportSVG(sim, P, renderer.w, renderer.h, name()));
$('ex-csv').addEventListener('click', () => X.exportCSV(sim, name()));
$('ex-json').addEventListener('click', () => X.exportPreset(P, name()));

const presetFile = $<HTMLInputElement>('preset-file');
$('ex-load').addEventListener('click', () => presetFile.click());
presetFile.addEventListener('change', async (e) => {
  const f = (e.target as HTMLInputElement).files?.[0];
  if (!f) return;
  try {
    Object.assign(P, await X.importPreset(f));
    applyAccent(); syncOrganisms(P.species); syncTools(P.tool);
    setMode(P.mode, false); panel.sync(); rate.set(P.timeScale); resetSim();
    say('Preset loaded.');
  } catch { say('That preset could not be read.'); }
});

const btnRec = $<HTMLButtonElement>('ex-webm');
btnRec.addEventListener('click', () => {
  if (recorder.active) {
    recorder.stop(name());
    btnRec.textContent = 'Record WebM';
    btnRec.setAttribute('aria-pressed', 'false');
    say('Recording saved.');
  } else if (recorder.start(canvas)) {
    btnRec.textContent = 'Stop recording';
    btnRec.setAttribute('aria-pressed', 'true');
    if (!running) setRunning(true);
    say('Recording.');
  } else {
    say('This browser cannot record WebM. Export PNGs instead.');
  }
});

$('btn-share').addEventListener('click', async () => {
  const url = X.shareURL(P);
  history.replaceState(null, '', url);
  try { await navigator.clipboard.writeText(url); say('Setup link copied to the clipboard.'); }
  catch { say('Setup link is now in the address bar.'); }
});

// ── leaving a culture to grow ────────────────────────────────────────────
const STORE = 'agar.culture.v1';

function saveCulture(): void {
  try {
    localStorage.setItem(STORE, JSON.stringify({ at: Date.now(), t: sim.t, params: P }));
  } catch { /* private mode, or the quota is full — the plate is not worth an error */ }
}

/**
 * Cultures keep growing while the tab is closed. Rather than serialising every
 * cell, the run is deterministic: same seed, same parameters, same result. We
 * store the parameters and fast-forward by the time that actually passed.
 */
function offerResume(): void {
  let saved: { at: number; t: number; params: Partial<Params> } | null = null;
  try { saved = JSON.parse(localStorage.getItem(STORE) ?? 'null'); } catch { saved = null; }
  if (!saved || !saved.params) return;
  const awayMin = (Date.now() - saved.at) / 60000;
  if (awayMin < 1 || awayMin > 60 * 24 * 14) return;

  const banner = $('resume');
  const grown = Math.min(awayMin * (saved.params.timeScale ?? 25) * 60, 60 * 96);
  $('resume-text').textContent =
    `A culture was left incubating ${awayMin < 60 ? `${Math.round(awayMin)} minutes` : `${(awayMin / 60).toFixed(1)} hours`} ago. ` +
    `Resuming will grow it forward by about ${(grown / 60).toFixed(0)} culture hours.`;
  banner.hidden = false;

  $('resume-no').addEventListener('click', () => { banner.hidden = true; localStorage.removeItem(STORE); });
  $('resume-yes').addEventListener('click', () => {
    banner.hidden = true;
    Object.assign(P, saved!.params);
    applyAccent(); syncOrganisms(P.species); syncTools(P.tool);
    setMode(P.mode, false); panel.sync(); rate.set(P.timeScale);
    resetSim();
    // Fast-forward with a coarse step; capped so the tab never locks up.
    const perStep = P.timeScale / 30;
    const steps = Math.min(6000, Math.max(0, Math.round(grown / Math.max(0.01, perStep))));
    for (let i = 0; i < steps; i++) sim.step(1 / 30, P);
    draw(); updateAll();
    say(`Culture resumed at ${(sim.t / 60).toFixed(1)} culture hours, population ${sim.stats().pop}.`);
  });
}

addEventListener('visibilitychange', () => { if (document.hidden) saveCulture(); });
addEventListener('pagehide', saveCulture);
setInterval(saveCulture, 20000);

// ── keyboard ─────────────────────────────────────────────────────────────
const KERNELS = ['bayer2', 'bayer4', 'bayer8', 'floyd', 'atkinson', 'jarvis', 'noise', 'halftone', 'none'] as const;
const TOOLS = ['inspect', 'feed', 'toxin', 'light', 'inoculate', 'scrape'] as const;
addEventListener('keydown', (e) => {
  const el = document.activeElement as HTMLElement | null;
  // Bail only where the key already means something to the focused control:
  // a text field is being typed into, a slider is being nudged, and Space has a
  // defined action on a button, a link, a disclosure or a checkbox. Everything
  // else — crucially the radio inputs behind the organism, tool and mode
  // pickers, which is where focus sits most of the time — falls through to the
  // shortcuts below. Treating every <input> as typing is what made Space stop
  // working the moment anyone chose an organism.
  const tag = el?.tagName ?? '';
  const type = (el as HTMLInputElement | null)?.type ?? '';
  const typing = tag === 'TEXTAREA' || tag === 'SELECT'
    || (tag === 'INPUT' && !/^(radio|hidden)$/.test(type));
  const nativeSpace = tag === 'BUTTON' || tag === 'SUMMARY'
    || (tag === 'A' && el!.hasAttribute('href'));
  if (typing || el?.isContentEditable || el?.getAttribute('role') === 'slider') return;
  if (nativeSpace && (e.key === ' ' || e.key === 'Enter')) return;
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const n = Number(e.key);
  if (n >= 1 && n <= 6) { const t = TOOLS[n - 1]; syncTools(t); P.tool = t; renderer.cursor.tool = t; $('tool-hint').textContent = TOOL_HINT[t]; say(`Tool: ${t}.`); return; }
  if (e.key === '[') { setBrush(P.brush * 0.85); return; }
  if (e.key === ']') { setBrush(P.brush * 1.18); return; }
  switch (e.key.toLowerCase()) {
    case ' ': e.preventDefault(); setRunning(!running); break;
    case '?': startTour(); break;
    case 's': sim.step(1 / 30, P); draw(); updateAll(); break;
    case 'r': resetSim(); say('Culture reset.'); break;
    case 'n': $('btn-reseed').click(); break;
    case 'p': $('btn-pulse').click(); break;
    case 'e': X.exportPNG(canvas, 2, name()); say('PNG exported.'); break;
    case 'd': {
      const i = (KERNELS.indexOf(P.dither as typeof KERNELS[number]) + 1) % KERNELS.length;
      P.dither = KERNELS[i];
      panel.sync(); draw();
      say(`Dither kernel: ${P.dither}.`);
      break;
    }
  }
});

// ── loop ─────────────────────────────────────────────────────────────────
let last = performance.now();
let fps = 60, uiTimer = 0;

function draw(): void { renderer.draw(sim, P); }

function updateAll(): void {
  const s = sim.stats();
  setReadout({
    phase: sim.phase.toUpperCase(),
    time: `${(sim.t / 60).toFixed(1)} h`,
    pop: String(s.pop),
    gen: s.generation.toFixed(1),
    sub: s.substrate.toFixed(3),
    died: String(s.died),
    spore: String(s.spores),
    sen: String(s.senescent),
    drug: sim.drug.toFixed(2),
    res: s.meanRes.toFixed(3),
    org: String(s.organelles),
    fps: fps.toFixed(0),
  });
  drawGrowth($<HTMLCanvasElement>('chart-growth'), sim);
  drawTraits($<HTMLCanvasElement>('chart-traits'), sim);
  renderLog($('log'), sim.log);
  syncMilestones(sim.milestones);
  const sp = speciesById(P.species);
  canvas.setAttribute('aria-label',
    `${P.mode === 'dish' ? 'Petri dish' : 'Culture plate'}. ${s.pop} cells of ${sp.label}, ${sp.kingdom}. ` +
    `${sim.phase} phase at ${(sim.t / 60).toFixed(1)} culture hours. ${s.died} lysed, ${s.spores} dormant, ` +
    `mean generation ${s.generation.toFixed(1)}.` +
    (P.mode === 'specimen' ? ` Specimen text: ${P.text.replace(/\n/g, ' ')}.` : ''));
  if (sim.phase !== lastPhase) {
    lastPhase = sim.phase;
    say(`${sim.phase} phase at ${(sim.t / 60).toFixed(1)} culture hours, population ${s.pop}.`);
  }
}

function tick(now: number): void {
  const dt = Math.min(1 / 20, Math.max(1 / 240, (now - last) / 1000));
  last = now;
  fps = fps * 0.9 + (1 / dt) * 0.1;
  if (running) sampleFrame(dt);

  if (running && P.view !== 'plate') {
    sim.step(dt, P);
    if (lifespanRun) {
      const alive = sim.stats().pop;
      const done = alive === 0 ||
        (sim.phase === 'death' && alive < Math.max(2, sim.peakPop * 0.03)) ||
        now - lifeStartedAt > 180_000;
      if (done) endLifespan(alive === 0 ? 'complete — culture extinct' : 'complete');
    }
    draw();
  }

  uiTimer += dt;
  if (uiTimer > 0.25) { uiTimer = 0; updateAll(); }
  requestAnimationFrame(tick);
}

// A slider inside a hidden panel has no width, so its handle cannot be placed
// until that panel is shown. Same on any layout change.
function reflowAll(): void { panel.reflow(); rate.reflow(); brush.reflow(); }
for (const d of document.querySelectorAll('details')) d.addEventListener('toggle', reflowAll);
addEventListener('resize', reflowAll);

// ── rail tabs ────────────────────────────────────────────────────────────
// One panel at a time. Forty controls in a single scrolling column is the
// thing that makes this tool look like a cockpit; the same forty controls
// behind four words do not.
function wireTabs(rail: HTMLElement): void {
  const list = rail.querySelector('.tabs') as HTMLElement | null;
  if (!list) return;
  const tabs = [...list.querySelectorAll<HTMLButtonElement>('.tab')];
  const ind = list.querySelector('.tab-ind') as HTMLElement | null;

  const slide = (): void => {
    const on = tabs.find((t) => t.getAttribute('aria-selected') === 'true');
    if (!on || !ind) return;
    ind.style.width = `${on.offsetWidth}px`;
    ind.style.transform = `translateX(${on.offsetLeft}px)`;
  };

  const select = (tab: HTMLButtonElement, focus = false): void => {
    for (const t of tabs) {
      const on = t === tab;
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
      const pane = document.getElementById(t.getAttribute('aria-controls') ?? '');
      if (pane) pane.hidden = !on;
    }
    slide();
    // Sliders inside the pane that just appeared have only now been given a
    // width, so their handles have to be placed again.
    reflowAll();
    if (focus) tab.focus();
  };

  list.addEventListener('click', (e) => {
    const t = (e.target as HTMLElement).closest('.tab') as HTMLButtonElement | null;
    if (t) select(t);
  });
  list.addEventListener('keydown', (e) => {
    const i = tabs.findIndex((t) => t === document.activeElement);
    if (i < 0) return;
    const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    select(tabs[(i + d + tabs.length) % tabs.length], true);
  });

  for (const t of tabs) t.tabIndex = t.getAttribute('aria-selected') === 'true' ? 0 : -1;
  requestAnimationFrame(slide);
  addEventListener('resize', slide);
  (rail as HTMLElement & { showTab?: (id: string) => void }).showTab = (id: string) => {
    const t = tabs.find((x) => x.id === id);
    if (t) select(t);
  };
}
wireTabs($('rail-left'));
wireTabs($('rail-right'));

const showTab = (railId: string, tabId: string): void => {
  ($(railId) as HTMLElement & { showTab?: (id: string) => void }).showTab?.(tabId);
};

// ── performance ──────────────────────────────────────────────────────────
// The tier caps how much work the plate is allowed to ask for. It never
// changes the biology — only the resolution it is observed at and the ceiling
// on population, both of which are already parameters.
function applyBudget(t: Tier): void {
  const b = budget(t);
  if (P.capacity > b.cells) { P.capacity = b.cells; panel.sync(); }
  if (P.pixelSize < b.pixel) { P.pixelSize = b.pixel; panel.sync(); }
  renderer.resize(renderer.w, renderer.h, P.pixelSize);
  for (const r of document.querySelectorAll<HTMLInputElement>('input[name="perf"]')) r.checked = r.value === t;
}
onTier(applyBudget);
for (const r of document.querySelectorAll<HTMLInputElement>('input[name="perf"]')) {
  r.addEventListener('change', () => {
    if (!r.checked) return;
    setTier(r.value as Tier);
    say(`Rendering quality set to ${r.value}.`);
  });
}

// ── the walkthrough ──────────────────────────────────────────────────────
const TOUR: Step[] = [
  {
    target: 'specimen-bar', side: 'bottom',
    title: 'Type something to grow',
    body: 'Whatever you type here becomes the growth medium. The letterforms are not drawn — they are the only place on the plate with anything to eat.',
  },
  {
    target: 'plate', side: 'left',
    title: 'This is a live culture',
    body: 'Every dot is a cell with its own age, size and genome. Watch a stroke fill in: that is division, not animation.',
  },
  {
    target: 'dock', side: 'top',
    title: 'The plate is the instrument',
    body: 'Pick a tool and drag on the plate — paint food and the colony walks towards it, paint antibiotic and watch resistance evolve. Scroll on the plate to resize the brush.',
  },
  {
    target: 'transport', side: 'top',
    title: 'Run it, or step it',
    body: 'Incubate runs the culture; Step advances one frame so you can look at it. Rate is how many simulated minutes pass per real second.',
  },
  {
    target: 'rail-left', side: 'right',
    title: 'Four tabs, not forty dials',
    body: 'Start has ready-made experiments. Organism is who is growing, Medium is what they are growing in, Look is how it is photographed. Anything deeper is folded away inside each tab.',
    before: () => showTab('rail-left', 'tab-start'),
  },
  {
    target: 'pane-export', side: 'left',
    title: 'Then take it with you',
    body: 'A still at four times size, the cells as SVG geometry, the run as WebM, the numbers as CSV. Everything is made in this tab and nothing is uploaded.',
    before: () => showTab('rail-right', 'tab-export'),
  },
];

function startTour(): void {
  showTab('rail-right', 'tab-curves');
  runTour(TOUR, () => { showTab('rail-right', 'tab-curves'); say('Walkthrough finished.'); });
}
$('btn-tour').addEventListener('click', startTour);

// ── narrow screens ───────────────────────────────────────────────────────
// Said once, dismissible, and never in the way of the thing it is describing.
{
  const bar = $('deskbar');
  let hidden = false;
  try { hidden = localStorage.getItem('agar.deskbar') === '1'; } catch { /* ignore */ }
  if (!hidden && matchMedia('(max-width: 820px)').matches) bar.hidden = false;
  $('deskbar-x').addEventListener('click', () => {
    // Leave the way it arrived, then take the space back.
    bar.classList.add('is-out');
    setTimeout(() => { bar.hidden = true; }, reduced.matches ? 0 : 280);
    try { localStorage.setItem('agar.deskbar', '1'); } catch { /* ignore */ }
  });
}

// ── the story band ───────────────────────────────────────────────────────
// Reveal on entry, once, and only as a shortened distance — reduced motion
// gets the same text with no travel.
{
  const beats = [...document.querySelectorAll('.beat, .story-cta')];
  if (beats.length && !reduced.matches) {
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
      }
    }, { rootMargin: '0px 0px -12% 0px' });
    for (const b of beats) io.observe(b);
  } else {
    for (const b of beats) b.classList.add('is-in');
  }
}

// Handle for the console: inspect or drive the culture directly.
(window as unknown as Record<string, unknown>).AGAR = { sim, P, renderer, step: (dt: number) => sim.step(dt, P) };

// ── boot ─────────────────────────────────────────────────────────────────
$<HTMLImageElement>('logo').src = logoUrl;

// The wordmark is colonised while the app wires itself up behind the overlay.
const bootEl = document.getElementById('boot');
if (bootEl) {
  void runBoot(bootEl, {
    paper: hexToRGB(P.paperColor), ink: hexToRGB(P.inkColor), acid: hexToRGB(P.acidColor),
  });
}

// The footer runs its own culture: black cells on acid, growing into the mark.
// It uses the brand colours rather than the plate's, so recolouring an
// experiment does not recolour the page furniture.
const footCanvas = document.getElementById('foot-canvas');
if (footCanvas) {
  runFooter(footCanvas as HTMLCanvasElement, {
    ink: hexToRGB(defaults.inkColor), acid: hexToRGB(defaults.acidColor),
  });
}

// The tier has to be known before the first plate is sized, or the machine
// gets one oversized frame before being told it cannot afford them.
const tier0 = initPerf();
applyBudget(tier0);

// Arriving from the Learn page with an organism already chosen.
{
  const want = new URLSearchParams(location.search).get('species');
  if (want && SPECIES_IDS.has(want)) P.species = want;
}

applyAccent();
applySpecies(P.species);
syncTools(P.tool);
setMode(P.mode, false);
panel.sync();
resetSim();
panel.reflow();
rate.reflow();
brush.reflow();
requestAnimationFrame(tick);
offerResume();
if (!reduced.matches) setRunning(true);
else say('Reduced motion is on, so the culture starts paused. Press Incubate or Space to begin.');
if (hasImportedFont()) fontStatus.textContent = `Culturing “${importedFontName()}”.`;

// First visit gets the walkthrough, once, after the boot overlay has cleared.
// Anyone who has seen it never sees it again unless they ask for it.
if (!tourSeen()) setTimeout(startTour, reduced.matches ? 400 : 5400);
