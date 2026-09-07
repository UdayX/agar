/**
 * Control panel.
 *
 * Generated from the schema in params.ts. Two rules keep it from turning into a
 * wall of sliders: a control declares which plate modes it belongs to, and it
 * declares whether it is essential or advanced. Only the essentials for the
 * current mode are on screen; everything else is one disclosure deeper.
 *
 * Help text is always in the accessibility tree — the toggle only decides
 * whether it is also on screen.
 */
import { CONTROLS, GROUPS, PRESETS, SPECIES, THEMES, MILESTONES, type Control, type Mode, type Params } from './params';
import { REFERENCES } from './references';
import { Slider } from './slider';

export type OnChange = (key: keyof Params, value: string | number | boolean) => void;

const fmt = (c: Control, v: unknown): string => {
  if (c.kind === 'range') {
    const n = Number(v);
    const dec = c.step >= 1 ? 0 : c.step >= 0.1 ? 1 : c.step >= 0.01 ? 2 : c.step >= 0.001 ? 3 : 4;
    return `${n.toFixed(dec)}${c.unit ? ` ${c.unit}` : ''}`;
  }
  return String(v);
};

/** Little diagrams so an organism can be recognised before it is read. */
function icon(shape: string): string {
  const a = 'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"';
  switch (shape) {
    case 'rod': return `<svg viewBox="0 0 32 32" aria-hidden="true"><rect x="6" y="12" width="20" height="8" rx="4" ${a}/></svg>`;
    case 'coccus': return `<svg viewBox="0 0 32 32" aria-hidden="true"><circle cx="12" cy="14" r="5" ${a}/><circle cx="21" cy="20" r="5" ${a}/></svg>`;
    case 'spiral': return `<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M4 16c3-7 6 7 9 0s6 7 9 0 6 7 6 0" ${a}/></svg>`;
    case 'filament': return `<svg viewBox="0 0 32 32" aria-hidden="true"><rect x="3" y="13" width="8" height="6" rx="3" ${a}/><rect x="12" y="13" width="8" height="6" rx="3" ${a}/><rect x="21" y="13" width="8" height="6" rx="3" ${a}/></svg>`;
    case 'bud': return `<svg viewBox="0 0 32 32" aria-hidden="true"><circle cx="14" cy="18" r="8" ${a}/><circle cx="24" cy="10" r="4" ${a}/></svg>`;
    case 'amoeboid': return `<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M8 12c4-6 12-4 14 1s4 10-2 12-13 1-14-4 0-6 2-9z" ${a}/><circle cx="16" cy="17" r="2.5" ${a}/></svg>`;
    case 'hypha': return `<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M3 16h9m0 0 7-7m-7 7 7 7m0-14h6m-6 14h6" ${a}/></svg>`;
    default: return `<svg viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="8" ${a}/></svg>`;
  }
}

export interface ControlPanel {
  sync: () => void;
  setMode: (m: Mode) => void;
  reflow: () => void;
}

export function buildControls(
  basics: HTMLElement, advanced: HTMLElement, p: Params, onChange: OnChange,
): ControlPanel {
  const syncers: (() => void)[] = [];
  const reflows: (() => void)[] = [];
  const byMode: { el: HTMLElement; modes?: Mode[] }[] = [];

  const makeControl = (c: Control, host: HTMLElement): void => {
    const id = `c-${String(c.key)}`;
    const hid = `${id}-help`;
    const lid = `${id}-label`;
    const wrap = document.createElement('div');
    wrap.className = 'ctl';

    const top = document.createElement('div');
    top.className = 'ctl-top';
    const usesNative = c.kind !== 'range';
    const label = document.createElement(usesNative ? 'label' : 'span');
    label.id = lid;
    label.className = 'lab';
    if (usesNative) (label as HTMLLabelElement).htmlFor = id;
    label.textContent = c.label;
    top.appendChild(label);

    const val = document.createElement('span');
    val.className = 'val';
    if (c.kind === 'toggle' || c.kind === 'text' || c.kind === 'colour' || c.kind === 'select') val.style.display = 'none';
    top.appendChild(val);

    const helpBtn = document.createElement('button');
    helpBtn.type = 'button';
    helpBtn.className = 'help-toggle';
    helpBtn.textContent = '?';
    helpBtn.setAttribute('aria-expanded', 'false');
    helpBtn.setAttribute('aria-controls', hid);
    helpBtn.setAttribute('aria-label', `Explain: ${c.label}`);
    top.appendChild(helpBtn);
    wrap.appendChild(top);

    const help = document.createElement('p');
    help.className = 'help collapsed';
    help.id = hid;
    help.textContent = c.help;

    let sync: () => void;

    if (c.kind === 'range') {
      const sl = new Slider({
        min: c.min, max: c.max, step: c.step, value: Number(p[c.key]),
        labelId: lid, describedBy: hid,
        format: (v) => fmt(c, v),
        onInput: (v) => { val.textContent = fmt(c, v); onChange(c.key, v); },
      });
      wrap.appendChild(sl.el);
      reflows.push(() => sl.reflow());
      sync = () => { const v = Number(p[c.key]); sl.set(v); val.textContent = fmt(c, v); };
    } else if (c.kind === 'select') {
      const sel = document.createElement('select');
      sel.id = id;
      sel.setAttribute('aria-describedby', hid);
      for (const [v, t] of c.options) {
        const o = document.createElement('option');
        o.value = v; o.textContent = t;
        sel.appendChild(o);
      }
      sel.addEventListener('change', () => onChange(c.key, sel.value));
      wrap.appendChild(sel);
      sync = () => { sel.value = String(p[c.key]); };
    } else if (c.kind === 'toggle') {
      const lbl = document.createElement('label');
      lbl.className = 'switch';
      const cb = document.createElement('input');
      cb.type = 'checkbox'; cb.id = id;
      cb.setAttribute('aria-describedby', hid);
      const box = document.createElement('span');
      box.className = 'box';
      const txt = document.createElement('span');
      txt.className = 'lab';
      txt.textContent = 'On';
      lbl.append(cb, box, txt);
      cb.addEventListener('change', () => onChange(c.key, cb.checked));
      wrap.appendChild(lbl);
      label.removeAttribute('for');
      sync = () => { cb.checked = Boolean(p[c.key]); };
    } else if (c.kind === 'colour') {
      const inp = document.createElement('input');
      inp.type = 'color'; inp.id = id;
      inp.className = 'swatch';
      inp.setAttribute('aria-describedby', hid);
      inp.addEventListener('input', () => onChange(c.key, inp.value));
      wrap.appendChild(inp);
      sync = () => { inp.value = String(p[c.key]); };
    } else if (c.kind === 'int') {
      const n = document.createElement('input');
      n.type = 'number'; n.id = id;
      n.min = String(c.min); n.max = String(c.max); n.step = '1';
      n.setAttribute('aria-describedby', hid);
      n.addEventListener('change', () => onChange(c.key, Number(n.value)));
      wrap.appendChild(n);
      sync = () => { n.value = String(p[c.key]); };
    } else {
      const ta = document.createElement('textarea');
      ta.id = id; ta.rows = 2; ta.spellcheck = false;
      ta.setAttribute('aria-describedby', hid);
      ta.addEventListener('input', () => onChange(c.key, ta.value));
      wrap.appendChild(ta);
      sync = () => { if (document.activeElement !== ta) ta.value = String(p[c.key]); };
    }

    wrap.appendChild(help);
    helpBtn.addEventListener('click', () => {
      const open = helpBtn.getAttribute('aria-expanded') === 'true';
      helpBtn.setAttribute('aria-expanded', String(!open));
      help.classList.toggle('collapsed', open);
    });

    sync();
    syncers.push(sync);
    byMode.push({ el: wrap, modes: c.modes });
    host.appendChild(wrap);
  };

  for (const c of CONTROLS.filter((x) => x.level === 'basic')) makeControl(c, basics);

  GROUPS.forEach((group, gi) => {
    const items = CONTROLS.filter((c) => c.group === group && c.level === 'advanced');
    if (!items.length) return;
    const block = document.createElement('details');
    block.className = 'block sub';
    block.innerHTML = `<summary><span class="idx">${String(gi + 1).padStart(2, '0')}</span> ${group}</summary>`;
    const body = document.createElement('div');
    body.className = 'block-body';
    block.appendChild(body);
    for (const c of items) makeControl(c, body);
    // A whole group can belong to one mode.
    const modes = items[0].modes;
    byMode.push({ el: block, modes: items.every((i) => i.modes === modes) ? modes : undefined });
    advanced.appendChild(block);
  });

  return {
    sync: () => syncers.forEach((s) => s()),
    setMode: (m) => {
      for (const b of byMode) b.el.hidden = Boolean(b.modes && !b.modes.includes(m));
      reflows.forEach((r) => r());
    },
    reflow: () => reflows.forEach((r) => r()),
  };
}

export function buildOrganisms(root: HTMLElement, p: Params, pick: (id: string) => void): (id: string) => void {
  const inputs: HTMLInputElement[] = [];
  for (const s of SPECIES) {
    const lbl = document.createElement('label');
    lbl.className = 'org';
    const input = document.createElement('input');
    input.type = 'radio';
    input.name = 'organism';
    input.value = s.id;
    input.checked = s.id === p.species;
    input.addEventListener('change', () => { if (input.checked) pick(s.id); });
    const fig = document.createElement('span');
    fig.className = 'org-icon';
    fig.innerHTML = icon(s.shape);
    const name = document.createElement('span');
    name.className = 'org-name';
    name.textContent = s.label;
    const sub = document.createElement('span');
    sub.className = 'org-sub';
    sub.textContent = s.short;
    lbl.append(input, fig, name, sub);
    lbl.title = s.note;
    root.appendChild(lbl);
    inputs.push(input);
  }
  return (id) => inputs.forEach((i) => { i.checked = i.value === id; });
}

export function buildTools(
  root: HTMLElement, p: Params, pick: (id: string) => void,
): (id: string) => void {
  const TOOLS: [string, string, string][] = [
    ['inspect', 'Inspect', 'Read a single cell’s genome and state.'],
    ['feed', 'Feed', 'Paint nutrient onto the plate. Motile cells will find it.'],
    ['toxin', 'Toxin', 'Paint antibiotic. Cells above their inherited MIC die; the rest flee it.'],
    ['light', 'Light', 'Drop a light beacon. Photoautotrophs feed on it and swim toward it.'],
    ['inoculate', 'Seed', 'Add cells of the selected organism.'],
    ['scrape', 'Scrape', 'Remove cells from the plate entirely.'],
  ];
  const inputs: HTMLInputElement[] = [];
  for (const [id, label, help] of TOOLS) {
    const lbl = document.createElement('label');
    lbl.className = 'tool';
    lbl.title = help;
    const input = document.createElement('input');
    input.type = 'radio';
    input.name = 'tool';
    input.value = id;
    input.checked = id === p.tool;
    input.addEventListener('change', () => { if (input.checked) pick(id); });
    const t = document.createElement('span');
    t.textContent = label;
    lbl.append(input, t);
    root.appendChild(lbl);
    inputs.push(input);
  }
  return (id) => inputs.forEach((i) => { i.checked = i.value === id; });
}

export function buildThemes(root: HTMLElement, pick: (t: typeof THEMES[number]) => void): void {
  for (const t of THEMES) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'theme';
    b.title = t.label;
    b.setAttribute('aria-label', `Colour scheme: ${t.label}`);
    b.innerHTML = `<span style="background:${t.paper}"></span><span style="background:${t.ink}"></span><span style="background:${t.acid}"></span>`;
    b.addEventListener('click', () => pick(t));
    root.appendChild(b);
  }
}

export function buildPresets(root: HTMLElement, pick: (id: string) => void): (active: string) => void {
  const buttons: HTMLButtonElement[] = [];
  for (const preset of PRESETS) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'preset';
    b.setAttribute('aria-pressed', 'false');
    b.dataset.id = preset.id;
    b.innerHTML = '<span class="pt"></span><span class="pn"></span>';
    (b.querySelector('.pt') as HTMLElement).textContent = preset.label;
    (b.querySelector('.pn') as HTMLElement).textContent = preset.note;
    b.addEventListener('click', () => pick(preset.id));
    root.appendChild(b);
    buttons.push(b);
  }
  return (active) => buttons.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.id === active)));
}

export function buildMilestones(root: HTMLElement): (found: Set<string>) => void {
  const items = new Map<string, HTMLElement>();
  for (const m of MILESTONES) {
    const li = document.createElement('li');
    li.className = 'ms';
    li.title = m.note;
    const mark = document.createElement('span');
    mark.className = 'ms-mark';
    mark.setAttribute('aria-hidden', 'true');
    const txt = document.createElement('span');
    txt.textContent = m.label;
    li.append(mark, txt);
    li.setAttribute('aria-label', `${m.label}: not yet observed`);
    root.appendChild(li);
    items.set(m.id, li);
  }
  return (found) => {
    for (const m of MILESTONES) {
      const li = items.get(m.id)!;
      const on = found.has(m.id);
      if (li.classList.contains('on') === on) continue;
      li.classList.toggle('on', on);
      li.setAttribute('aria-label', `${m.label}: ${on ? 'observed' : 'not yet observed'}`);
    }
  };
}

export function buildRefs(root: HTMLElement): void {
  for (const r of REFERENCES) {
    const li = document.createElement('li');
    const b = document.createElement('b');
    b.textContent = `${r.authors} (${r.year}). `;
    const t = document.createElement('span');
    t.textContent = `${r.title}. ${r.venue}.`;
    const u = document.createElement('span');
    u.className = 'used';
    u.textContent = r.used;
    li.append(b, t, u);
    root.appendChild(li);
  }
}

export interface StatSpec { key: string; label: string; hot?: boolean; }

export function buildReadout(root: HTMLElement, specs: StatSpec[]): (values: Record<string, string>) => void {
  const map = new Map<string, HTMLElement>();
  for (const s of specs) {
    const d = document.createElement('div');
    d.className = 'cellstat';
    const k = document.createElement('span');
    k.className = 'k';
    k.textContent = s.label;
    const v = document.createElement('span');
    v.className = s.hot ? 'v hot' : 'v';
    v.textContent = '—';
    d.append(k, v);
    root.appendChild(d);
    map.set(s.key, v);
  }
  return (values) => {
    for (const [k, v] of Object.entries(values)) {
      const el = map.get(k);
      if (el && el.textContent !== v) el.textContent = v;
    }
  };
}

export function renderLog(root: HTMLElement, lines: { t: number; kind: string; text: string }[]): void {
  const wanted = lines.slice(-40).reverse();
  if (root.childElementCount === wanted.length &&
      root.firstElementChild?.getAttribute('data-t') === String(wanted[0]?.t)) return;
  root.textContent = '';
  for (const l of wanted) {
    const li = document.createElement('li');
    li.className = l.kind === 'phase' ? 'phase' : l.kind === 'milestone' ? 'milestone' : '';
    li.setAttribute('data-t', String(l.t));
    const t = document.createElement('span');
    t.className = 't';
    t.textContent = `${(l.t / 60).toFixed(1)}h`;
    const m = document.createElement('span');
    m.className = 'm';
    m.textContent = l.text;
    li.append(t, m);
    root.appendChild(li);
  }
}
