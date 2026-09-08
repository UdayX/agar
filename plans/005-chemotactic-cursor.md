# 005 — A chemotactic cursor: the pointer as an attractant source

- **Commit:** a048954
- **Severity:** — (additive; requested feature, not a defect)
- **Category:** 8 — Missed opportunities
- **Estimated scope:** 1 new file, 3 edited, ~150 lines

## Problem

The site's whole thesis is that a bacterium finds food without deciding to. It runs
in a straight line, tumbles at random, and tumbles *less often* while conditions
happen to be improving — Berg & Brown 1972, already cited on the attributions page
and already implemented twice in this repo. The cursor is the one surface where a
visitor's own movement could drive that, and today it is the operating system arrow.

The ask: a cursor inspired by the organisms, dynamic and interactive.

**The trap to avoid.** The obvious version — hide the native cursor, draw a blob,
follow the pointer — is wrong here and must not be built. It adds a frame of latency
to every click in a tool people are meant to *work* in, it breaks the brush cursor
the plate already draws, and it is a portfolio trick rather than an idea. This plan
keeps the real cursor untouched and gives it **companions**: a few cells that
chemotax toward the pointer and never quite catch it. Move slowly and they gather;
move fast and they fall behind and have to search. That is the simulation, run on
the visitor's own hand.

**State this honestly:** this is decoration on a surface visible one hundred percent
of the time, which is the frequency band where "delight" is normally a defect. It
survives only because of the four constraints in *Target §5*. If any of them is
dropped, the feature should be dropped with it.

## Where

| File | Lines | What's there |
| --- | --- | --- |
| `src/cursor.ts` | — | **New file.** |
| `src/main.ts` | 26–30 | Imports and the `reduced` MediaQueryList |
| `src/learn.ts` | 13–22 | Imports and `initPerf()` |
| `src/style.css` | end | One rule for the canvas |

### Existing code to copy from

The run-and-tumble is already written twice. Do not invent a third variant — port
this one, which is the loader's:

```ts
// src/loader.ts:130
  const swimScouts = (dt: number): void => {
    const v = 26 * dt;                       // grid cells per second
    for (const s of scouts) {
      if (!s.alive) continue;
      const before = Math.hypot(s.x - cx, s.y - cy);
      s.x += Math.cos(s.a) * v;
      s.y += Math.sin(s.a) * v;
      const after = Math.hypot(s.x - cx, s.y - cy);
      // tumble rate drops while the sensed direction is improving
      if (Math.random() < (after < before ? 0.6 : 2.6) * dt) s.a += (Math.random() - 0.5) * 2.4;
```

And this is the house rule for page furniture taking brand colours rather than the
plate's:

```ts
// src/main.ts:797 — comment on runFooter
// The footer runs its own culture: black cells on acid, growing into the mark.
// It uses the brand colours rather than the plate's, so recolouring an
// experiment does not recolour the page furniture.
```

## Target

### 1. The new module

`src/cursor.ts`, exporting one function:

```ts
export function runCursor(o: { ink: RGB }): () => void
```

It creates its own `<canvas class="swarm" aria-hidden="true">`, appends it to
`document.body`, and returns a teardown.

### 2. Behaviour

Six cells (four at the `balanced` tier). Each holds `{ x, y, a }` in CSS pixels.

Per frame, with `dt` clamped to `0.05`:

```
SPEED   = 96          px/s, free swimming
NEAR    = 34          px — inside this radius, speed halves; the pointer is a
                          source, not a destination, and they should mill
TUMBLE_CLOSING = 0.6  /s   ← both constants are loader.ts's, unchanged
TUMBLE_AWAY    = 2.6  /s
TURN    = 2.4         rad, the tumble reorientation
```

1. `before = hypot(cell − pointer)`
2. advance along `a` at `SPEED * (dist < NEAR ? 0.5 : 1) * dt`
3. `after = hypot(cell − pointer)`
4. `if (Math.random() < (after < before ? TUMBLE_CLOSING : TUMBLE_AWAY) * dt) a += (Math.random() - 0.5) * TURN`
5. wrap at the viewport edges, exactly as `loader.ts:140-141` does

No steering, ever. A cell must never be turned toward the pointer directly — the
entire point is that biased tumbling alone is enough, and a visitor who watches
closely should be able to see it fail and recover.

**On `pointerdown`:** set `bias = 1` and decay it `bias -= dt / 0.45`. While
`bias > 0`, use `TUMBLE_CLOSING` in *both* branches, so every cell holds its heading
and the group converges. This is a nutrient pulse — the same gesture the `feed` tool
performs on the plate — and it is the only interactive beat in the feature.

### 3. Drawing

```
CELL = 3            device px per sample — the same grid as loader.ts and footer.ts
DPR  = 1            deliberate: this is a dither, so one device pixel is one sample
```

Each cell draws as one `CELL × CELL` square of ink, snapped to the grid, at
`globalAlpha = 0.5`. The pointer itself gets nothing drawn on it — no ring, no dot.
The native arrow is the marker.

Clear with a dirty rectangle, not the whole viewport: track the bounding box of all
cells plus the pointer from the previous frame, inflate it by `CELL * 2`, and
`clearRect` only that. The swarm stays near the pointer, so this is typically a few
hundred square pixels rather than a million.

### 4. Lifecycle

- Start the loop on the first `pointermove`.
- Track `lastMove`. When `performance.now() - lastMove > 2500`, decay `SPEED` toward
  zero over 600ms, then `cancelAnimationFrame` and stop. Restart on the next
  `pointermove`. **Idle costs zero frames.**
- On `pointerleave` from the document, stop immediately.

### 5. The four constraints — none of these is optional

1. **The native cursor is never hidden.** No `cursor: none`, anywhere. The canvas is
   `pointer-events: none`. Nothing this feature does can add latency to a click.
2. **Off over the plate.** On `pointermove`, if
   `document.elementFromPoint(x, y)?.closest('.canvas-wrap')` is non-null, fade the
   swarm to `opacity: 0` over 200ms and stop the loop. The plate draws its own
   cursor and its own cells; two populations in one frame is confusion, not
   atmosphere. Resume on leaving.
3. **Never initialised** when any of these holds — checked once, at startup:
   `matchMedia('(pointer: coarse)').matches`,
   `matchMedia('(prefers-reduced-motion: reduce)').matches`,
   or `initPerf()` returned `'low'`. Subscribe to `onTier` and tear down if the tier
   drops to `low` later.
4. **Alpha stays at 0.5 and the count stays at six.** This is peripheral-vision
   atmosphere, in the same register as the 4% acid sweep on the header rule
   (`src/style.css:124`). If it is legible enough to read as a feature, it is too
   loud.

### 6. The stylesheet

```css
/* One canvas, fixed, inert. Below the walkthrough (150) and the organism panel
   (120), above the page. */
.swarm {
  position: fixed; inset: 0; z-index: 90;
  pointer-events: none;
  image-rendering: pixelated;
  opacity: 1; transition: opacity 200ms var(--ease-out);
}
.swarm.is-away { opacity: 0; }
```

**Why these values:** `0.6` and `2.6` per second are lifted unchanged from
`src/loader.ts:139` so the three swarms on this site obey one law. `96 px/s` is
about a third of a typical pointer's travel speed, which is what guarantees they
lose the race — a swarm that keeps up stops being chemotaxis and becomes a trail.
`34px` keeps them off the arrow itself. `CELL = 3` and `DPR = 1` match
`src/loader.ts:21` and `src/footer.ts:20-42`, whose comment states the reasoning: a
dither wants one device pixel per sample. `0.45s` for the pulse decay is long enough
to see the group commit and short enough that it is over before the click's own
effect lands. `z-index: 90` sits under `.org-detail` (120) and `.tour` (150), which
are the two things that must never be swum over.

## Conventions to follow

- **Zero runtime dependencies.** This is a hard project rule. Canvas 2D only.
- `src/footer.ts` is the exemplar for the whole shape of this module: it creates its
  own canvas context, owns a `requestAnimationFrame` loop, stops the loop when the
  element is not visible, and returns a teardown function that removes every
  listener it added. Match its structure, its comment density and its tone.
- Take colours from `defaults` in `src/params.ts` via `hexToRGB`, **not** from the
  live `P`. See the comment at `src/main.ts:795-797`.
- Tokens live in `src/style.css:39-42`.
- Perf tier: `initPerf()` and `onTier()` from `src/perf.ts`. Never read
  `navigator.hardwareConcurrency` directly; that decision is already centralised.

## Steps

1. Write `src/cursor.ts` following `src/footer.ts`'s structure.
2. Add the `.swarm` rules to `src/style.css`.
3. In `src/main.ts`, import `runCursor` and call it after the footer is started,
   passing `hexToRGB(defaults.inkColor)`.
4. In `src/learn.ts`, call it too — the library page has no plate, so constraint 2
   is inert there and the swarm covers the whole page.
5. Do **not** add it to `attributions.html` — that page is a reference list and
   deliberately shares nothing with the simulation bundle
   (`src/attributions.ts:1-3`).

## Out of scope

- Do not hide, restyle, or replace the native cursor anywhere in the codebase.
- Do not touch `renderer.cursor` or the brush ring the plate draws
  (`src/main.ts:370-379`).
- Do not add a second canvas, a WebGL context, or a library.
- Do not make the cells interact with each other. Six independent walkers is the
  whole model; flocking is a different paper and a different feature.
- Do not add a settings toggle in this plan — see Notes.

## Verification

**Build**
- [ ] `npx tsc --noEmit` passes.
- [ ] `npx vite build` succeeds and `package.json` still lists zero `dependencies`.

**Behavior**
- [ ] Move the pointer slowly across the page. The cells converge on it and mill.
- [ ] Move it fast across the viewport. They fall behind, lose it, and search —
      they must *not* track it.
- [ ] Hold still for three seconds. They coast to a stop and the rAF loop stops.
      Confirm in DevTools Performance that idle frames are zero, not 60fps of
      no-op.
- [ ] Move onto the culture plate. The swarm fades out within 200ms and the loop
      stops. Move off: it comes back.
- [ ] Click anywhere off the plate. The group visibly commits toward the pointer for
      under half a second, then relaxes.
- [ ] Open the walkthrough and the organism detail panel. Nothing swims over either.
- [ ] Every button, slider and tab still responds on the first click. If anything
      needs two clicks, `pointer-events: none` is missing.
- [ ] Emulate `prefers-reduced-motion: reduce` and reload — the canvas is not in the
      DOM at all.
- [ ] Set Performance to Low in the right rail — the canvas is removed.
- [ ] Open on a touch device or emulate a coarse pointer — never initialised.
- [ ] Resize the window mid-swim: cells stay on screen.

**Performance**
- [ ] Profile 10 seconds of continuous pointer movement. Scripting for this module
      should be under ~0.3ms per frame. If `clearRect` shows up, the dirty rectangle
      was not implemented.

**Feel**
- [ ] Record 15 seconds of ordinary use — not a demo sweep, actual clicking around
      the rails — and watch it back. The question is whether you notice it. If you
      keep looking at it instead of the tool, lower the alpha or the count.
- [ ] Look at it again the next day before calling it done.

## Notes

Two things this plan deliberately does not settle.

**Whether it should exist on the lab page at all.** The Learn page is a library —
browsing, low stakes, and the swarm belongs there without question. The lab is a
tool someone is trying to concentrate in. The honest test is the 15-second recording
above, and if it fails, shipping it on `learn.html` only is a perfectly good
outcome, not a retreat.

**Whether it needs a switch.** Adding one is easy — the Performance segmented
control in the right rail already has the pattern. It is left out here because a
setting nobody changes is dead weight, and the three automatic gates cover the
people who genuinely need it off. Revisit only if the swarm survives the feel check
and someone still asks for the switch.

The count and alpha are the two values most likely to be wrong on first build. Six
at 0.5 is a starting point derived from the header sweep's register, not a measured
result.

---

## Corrected after implementation

Three changes, one of them a defect in this plan.

**The plan's own bug: hit-testing on pointermove.** Constraint 2 specified
`document.elementFromPoint(x, y)?.closest('.canvas-wrap')` on every move to
decide whether the swarm is over the plate. `elementFromPoint` forces a
synchronous layout, and `pointermove` is the hottest event in the browser —
paying a layout on each one, to learn something two listeners already know, is
exactly the cost the rest of this pass exists to remove. Replaced with
`pointerenter`/`pointerleave` bound to `.canvas-wrap` itself: O(1), event-driven,
zero layout. On the library page there is no plate, nothing is bound, and the
gate is simply inert.

**Resizing a canvas resets its 2D context.** `globalAlpha` and `fillStyle` were
set once at startup, so the first window resize would have brought the swarm
back at full opacity in default black. They are restated inside `layout()`, and
`prevBox` is cleared there too — last frame's dirty rectangle means nothing at a
new size.

**The low tier now makes it dormant rather than destroying it.** Constraint 3
said to tear down if `onTier` later reports `low`. That is right for the
automatic step-down but wrong for the segmented control, which a person can set
by hand: turning the tier back up left the swarm gone until a reload. It now
stops the loop and hides the canvas, which costs the same as not existing and
can be undone.

**Verified.** Six cells at the high tier (54 painted pixels, 3×3 each), and they
move. Against a stationary pointer they moved *away* — which a steering
implementation could never do. Convergence cannot be observed through this
harness (it renders one frame per screenshot, far too coarse for a run-and-tumble
walk), so the model was checked numerically at 60fps against a control that
tumbles at a constant rate:

```
biased tumbling : 436  392  367  371  372
unbiased control: 421  403  452  466  464
(mean px from the pointer, every 5s over 20s, mean of 40 runs)
```

The bias is what gathers them, and they settle at a distance rather than
arriving — which is the behaviour the feature is for.

