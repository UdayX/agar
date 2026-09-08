# 004 — Press feedback on the last two controls, and confirmation on export

- **Commit:** a048954
- **Severity:** MEDIUM
- **Category:** 8 — Missed opportunities (plus 3 — Physicality)
- **Estimated scope:** 3 files, ~40 lines

## Problem

Three gaps in an otherwise complete feedback system.

**One.** `.btn`, `.org`, `.theme`, `.help-toggle` and `.deskbar-x` all press with
`transform: scale(0.97)`. `.tool` and `.preset` do not — they have hover states and
nothing on `:active`. A control that reacts to the cursor but not to the click feels
dead, and here the inconsistency is the defect: two controls out of seven behave
differently for no reason a user could infer.

**Two.** The six export buttons download a file and give sighted users **nothing**.
The only acknowledgement is `say()`, which writes to an `aria-live` region. Exporting
is the payoff action of the entire tool, and it currently feels like the click was
dropped.

**Three.** `Copy link` has the same hole: the clipboard write succeeds and the button
does not move.

## Where

| File | Lines | What's there |
| --- | --- | --- |
| `src/style.css` | 399–408 | `.tool` — hover only |
| `src/style.css` | 525–541 | `.preset` — hover only |
| `src/style.css` | 366–373 | `.btn` — the exemplar, already correct |
| `src/main.ts` | 439–445 | The six export click handlers |
| `src/main.ts` | 477–482 | `btn-share` |

### Current code

```css
/* src/style.css:366 — the exemplar to copy */
.btn {
  ...
  transition: transform var(--fast) var(--ease-out), background var(--fast) ease,
              border-color var(--fast) ease, color var(--fast) ease;
}
.btn:active { transform: scale(0.97); }
.btn:disabled:active { transform: none; }
```

```ts
// src/main.ts:439
const name = () => `agar-${P.species}-${X.stamp()}`;
$('ex-png1').addEventListener('click', () => X.exportPNG(canvas, 1, name()));
$('ex-png2').addEventListener('click', () => X.exportPNG(canvas, 2, name()));
$('ex-png4').addEventListener('click', () => X.exportPNG(canvas, 4, name()));
$('ex-svg').addEventListener('click', () => X.exportSVG(sim, P, renderer.w, renderer.h, name()));
$('ex-csv').addEventListener('click', () => X.exportCSV(sim, name()));
$('ex-json').addEventListener('click', () => X.exportPreset(P, name()));
```

```ts
// src/main.ts:477
$('btn-share').addEventListener('click', async () => {
  const url = X.shareURL(P);
  history.replaceState(null, '', url);
  try { await navigator.clipboard.writeText(url); say('Setup link copied to the clipboard.'); }
  catch { say('Setup link is now in the address bar.'); }
});
```

## Target

### 1. Press states

```css
.tool span { transition: background var(--fast) ease, color var(--fast) ease,
                         transform var(--fast) var(--ease-out); }
.tool:active span { transform: scale(0.97); }

.preset { transition: background var(--fast) ease, transform var(--fast) var(--ease-out); }
.preset:active { transform: scale(0.97); }
```

Note the scale on `.tool` goes on the **`span`**, not the label — the `input` is an
absolutely-positioned overlay filling the label, and scaling the label would scale
the hit target out from under the pointer mid-click.

### 2. A shared confirmation helper

Add to `src/main.ts`, near `say()` at line 49:

```ts
/**
 * Say it on the button as well as to the screen reader. The label swaps behind a
 * short blur, which is what stops the two words reading as two separate objects
 * flickering in the same box.
 */
function confirmOn(btn: HTMLButtonElement, word: string, ms = 1400): void {
  if (btn.dataset.busy) return;
  const was = btn.textContent ?? '';
  btn.dataset.busy = '1';
  btn.classList.add('is-saying');
  setTimeout(() => { btn.textContent = word; }, reduced.matches ? 0 : 90);
  setTimeout(() => {
    btn.textContent = was;
    btn.classList.remove('is-saying');
    delete btn.dataset.busy;
  }, ms);
}
```

```css
.btn { /* add to the existing transition list */ }
.btn.is-saying { animation: btn-say 1400ms var(--ease-out); }
@keyframes btn-say {
  0%   { filter: blur(0);   opacity: 1; }
  8%   { filter: blur(2px); opacity: 0.55; }
  20%  { filter: blur(0);   opacity: 1; }
  88%  { filter: blur(0);   opacity: 1; }
  94%  { filter: blur(2px); opacity: 0.55; }
  100% { filter: blur(0);   opacity: 1; }
}
html[data-perf="low"] .btn.is-saying { animation: none; }
@media (prefers-reduced-motion: reduce) { .btn.is-saying { animation: none; } }
```

### 3. Wire it up

```ts
$('ex-png1').addEventListener('click', (e) => {
  X.exportPNG(canvas, 1, name());
  confirmOn(e.currentTarget as HTMLButtonElement, 'Saved');
});
```

…and the same for `ex-png2`, `ex-png4`, `ex-svg`, `ex-csv`, `ex-json`.

```ts
$('btn-share').addEventListener('click', async (e) => {
  const btn = e.currentTarget as HTMLButtonElement;
  const url = X.shareURL(P);
  history.replaceState(null, '', url);
  try {
    await navigator.clipboard.writeText(url);
    say('Setup link copied to the clipboard.');
    confirmOn(btn, 'Copied');
  } catch {
    say('Setup link is now in the address bar.');
    confirmOn(btn, 'In the bar');
  }
});
```

**Why these values:** `scale(0.97)` is copied verbatim from `.btn:active` — press
feedback should be felt, not seen, and 0.9 or lower is visibly aggressive.
`var(--fast)` (140ms) matches every other press in the app. `2px` of blur across the
label swap is the documented amount for making two states read as one morph rather
than two objects. `90ms` before the text changes puts the swap at the blurriest
point. `1400ms` total is long enough to be read without the button feeling stuck.
Keyframes rather than transitions here because this is a fire-and-forget sequence
with an automatic return, and the `data-busy` guard makes it non-re-triggerable —
the case the keyframe/transition rule explicitly exempts.

## Conventions to follow

- Tokens live in `src/style.css:39-42`; `--fast: 140ms`, `--ease-out` is
  `cubic-bezier(0.23, 1, 0.32, 1)`.
- `.btn:active` at `src/style.css:370` is the exemplar for press states — copy the
  value, do not invent one.
- Every animation in this file has both a `html[data-perf="low"]` and a
  `prefers-reduced-motion` escape. See `src/style.css:1126-1136`. Add both.
- `reduced` is a `MediaQueryList` in `src/main.ts:28` — the property is
  `reduced.matches`, not a boolean.
- `say()` at `src/main.ts:49` stays. This adds a visual channel; it does not replace
  the screen-reader one.

## Steps

1. Add the two press rules to `src/style.css`.
2. Add `.btn.is-saying`, the `btn-say` keyframes, and both escape rules.
3. Add `confirmOn()` to `src/main.ts` below `say()`.
4. Convert the six export handlers to arrow functions taking `e` and calling
   `confirmOn`.
5. Add `confirmOn` to both branches of the share handler.

## Out of scope

- Do not touch `ex-webm` (`src/main.ts:461-476`). It is a toggle with a real
  `aria-pressed` state and its own label swap; a confirmation on top would conflict.
- Do not touch `ex-load` — it opens a file picker, which is its own feedback.
- Do not change `say()` or the `aria-live` region.
- Do not add press states to `.tab` — the sliding `.tab-ind` already acknowledges
  that press, and a second acknowledgement of one event is noise.
- Do not change any export logic in `src/export.ts`.

## Verification

**Build**
- [ ] `npx tsc --noEmit` passes.

**Behavior**
- [ ] Press each of the six export buttons. The label blurs, becomes `Saved`, holds,
      then blurs back to its original text. The file still downloads.
- [ ] Press one twice quickly. The second press is ignored while the first is
      showing; the label never ends up stuck on `Saved`.
- [ ] Press `Copy link`. It reads `Copied` and the URL is on the clipboard.
- [ ] Deny clipboard permission and press it again — the fallback branch fires and
      the label still returns to `Copy link`.
- [ ] Press a tool in the canvas toolbar and a preset in the left rail. Both dip
      under the pointer.
- [ ] Press a tool and drag off it before releasing. The scale releases; the hit
      target does not move out from under the pointer.
- [ ] With `prefers-reduced-motion: reduce` and with Performance set to Low, the
      label still swaps — there is just no blur. Reduced motion means gentler, not
      absent.

**Feel**
- [ ] Record one export press and scrub. The word should appear to *become* the
      other word, not to replace it. If you can see two words, raise the blur to 3px.

## Notes

`Saved` is used for all six exports rather than per-format wording, so the buttons
all settle to the same width mid-swap. If a format ever fails silently, this makes
the button lie — the export functions in `src/export.ts` currently cannot fail
asynchronously, but if that changes, `confirmOn` should move behind the success path.

---

## Corrected after implementation

The plan swapped `btn.textContent` for the confirmation word. That is a layout
animation, which is the one thing this rule set exists to prevent.

"Saved" is not the width of "PNG 1×", and the export rows are `flex: 1 1 auto`,
so the button's own content feeds the layout: pressing PNG 1× measurably moved
PNG 2× and PNG 4× sideways. Pinning `style.width` did not fix it either — with
`flex-basis: auto` the content width *is* the basis, so overriding it just
redistributed the row differently (SVG geometry went 239px → 302px).

The fix is not to change the contributed size at all. The original text node
stays; `data-say` carries the word, `.btn.is-saying::after` paints it over the
label, and one pair of keyframes on a single 1400ms duration cross-fades the two
so the swap lands at the blurriest point and cannot drift:

```css
.btn.is-saying::after { content: attr(data-say); position: absolute; inset: 0; }
@keyframes btn-say  { 0% { color: var(--ink); } 10%, 86% { color: transparent; } … }
@keyframes btn-word { 0%, 8% { opacity: 0; } 20%, 88% { opacity: 1; } … }
```

Measured after the change: zero movement on any of the six buttons, and geometry
identical before and after the confirmation. It also leaves the accessible name
alone — `say()` was always the screen-reader channel, and the button no longer
renames itself for 1.4 seconds.

One knock-on: the clipboard fallback word was "In the bar", which is longer than
the "Copy link" label it now has to sit inside. Shortened to "In URL".

