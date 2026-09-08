# 001 — Move the walkthrough spotlight and card off layout properties

- **Commit:** a048954
- **Severity:** HIGH
- **Category:** 5 — Performance (plus one 6 — Accessibility fix)
- **Estimated scope:** 2 files, ~45 lines

## Problem

The walkthrough spotlight is a transparent box with a `9999px` box-shadow, and it
moves between steps by transitioning `left`, `top`, `width` and `height`. Those are
layout properties: every frame of every step runs Layout → Paint → Composite, and
the Paint step repaints a viewport-sized shadow. The coach card transitions `left`
and `top` for the same reason. This is the single most expensive motion on the page
and it runs during onboarding — the one moment a first-time visitor is forming an
opinion of whether the tool is fast.

The rule: only `transform` and `opacity` skip Layout and Paint. Everything else
triggers all three rendering steps.

## Where

| File | Lines | What's there |
| --- | --- | --- |
| `src/style.css` | 847–857 | `.tour-spot` — the box-shadow spotlight and its layout transition |
| `src/style.css` | 858–866 | `.tour-card` — transitions `left` and `top` |
| `src/tour.ts` | 62–92 | `place()` writes `style.left/top/width/height` on both |
| `src/tour.ts` | 36–37 | The `.tour` markup that needs a new dim layer |
| `src/tour.ts` | 99 | `scrollIntoView({ behavior: 'smooth' })`, ungated |

### Current code

```css
/* src/style.css:847 */
.tour-spot {
  position: fixed; border: 1px solid var(--acid-line);
  box-shadow: 0 0 0 9999px rgba(17, 17, 17, 0.42);
  opacity: 0;
  transition: opacity var(--med) var(--ease-out),
              left var(--med) var(--ease-out), top var(--med) var(--ease-out),
              width var(--med) var(--ease-out), height var(--med) var(--ease-out);
}
```

```css
/* src/style.css:858 */
.tour-card {
  position: fixed; width: min(320px, calc(100vw - 24px));
  background: var(--panel); border: 1px solid var(--ink);
  padding: var(--s4) var(--s4) var(--s3);
  pointer-events: auto;
  opacity: 0; transform: scale(0.985);
  transition: opacity var(--med) var(--ease-out), transform var(--med) var(--ease-out),
              left var(--med) var(--ease-out), top var(--med) var(--ease-out);
}
.tour.is-in .tour-card { opacity: 1; transform: none; }
```

```ts
// src/tour.ts:68
    const r = el.getBoundingClientRect();
    spot.style.left = `${r.left - PAD}px`;
    spot.style.top = `${r.top - PAD}px`;
    spot.style.width = `${r.width + PAD * 2}px`;
    spot.style.height = `${r.height + PAD * 2}px`;
```

```ts
// src/tour.ts:91
    card.style.left = `${Math.max(12, Math.min(vw - cw - 12, x))}px`;
    card.style.top = `${Math.max(12, Math.min(vh - ch - 12, y))}px`;
```

## Target

Three separate changes.

### 1. The dim becomes its own layer, cut by `clip-path`

Add a `.tour-dim` element covering the viewport. It carries the dim colour and a
rectangular hole punched with `clip-path: polygon(...)`. `clip-path` is composited
and interpolates between polygons that have the same number of points, so the hole
glides and resizes without a single Layout or Paint.

```css
.tour-dim {
  position: fixed; inset: 0;
  background: rgba(17, 17, 17, 0.42);
  opacity: 0;
  transition: opacity var(--med) var(--ease-out),
              clip-path var(--med) var(--ease-out);
}
.tour.is-in .tour-dim { opacity: 1; }
.tour.is-out .tour-dim { opacity: 0; }
```

`place()` sets the hole: trace the outside, trace the hole, and let `evenodd`
decide what is inside.

```ts
const bw = dim.clientWidth, bh = dim.clientHeight;
const cl = (v: number, max: number): number => (v < 0 ? 0 : v > max ? max : v);
const x0 = cl(r.left - PAD, bw), y0 = cl(r.top - PAD, bh);
const x1 = cl(r.right + PAD, bw), y1 = cl(r.bottom + PAD, bh);
dim.style.clipPath =
  `polygon(evenodd, 0px 0px, ${bw}px 0px, ${bw}px ${bh}px, 0px ${bh}px, 0px 0px, ` +
  `${x0}px ${y0}px, ${x1}px ${y0}px, ${x1}px ${y1}px, ${x0}px ${y1}px, ${x0}px ${y0}px)`;
```

Three things this depends on. **Corrected after the first implementation shipped
a layer that dimmed nothing at all** — the original draft of this plan specified
the winding trick and `innerWidth`, and both are wrong:

- **`evenodd`, not the default `nonzero`.** Relying on opposing winding
  directions works only while the hole sits strictly inside the outer ring. The
  moment a highlighted element is wider than the ring — which most of the rails
  are — the windings stop cancelling and the whole layer is clipped away.
- **The ring is measured from the element, not `innerWidth`.** `clip-path`
  resolves against the element's own border box, and a vertical scrollbar makes
  that ~15px narrower than the viewport. A ring 15px too wide overhangs the box
  and clips everything away — the same failure from the other end.
- **The hole is clamped to that box**, so it can never overhang either. An
  element scrolled half off screen still gets a hole, just a cropped one.

The point count is fixed at ten in every step, which is what makes it interpolate.

### 2. The spotlight ring keeps its geometry but loses the shadow

```css
.tour-spot {
  position: fixed; left: 0; top: 0;
  border: 1px solid var(--acid-line);
  opacity: 0;
  transition: opacity var(--med) var(--ease-out),
              transform var(--med) var(--ease-out),
              width var(--med) var(--ease-out), height var(--med) var(--ease-out);
}
```

```ts
spot.style.transform = `translate3d(${r.left - PAD}px, ${r.top - PAD}px, 0)`;
spot.style.width = `${r.width + PAD * 2}px`;
spot.style.height = `${r.height + PAD * 2}px`;
```

`width`/`height` still transition, and that is deliberate: this element is
`position: fixed` with no children and — now that the shadow has moved to
`.tour-dim` — nothing but a 1px border to repaint. That is the documented exception
for layout animation. Position moves to `transform` because position is the part
that travels furthest.

### 3. The card positions with `transform`, and the entry scale moves inward

`.tour-card` cannot both be positioned by `transform` and scale by `transform`, so
the entry animation moves to an inner wrapper.

```html
<div class="tour-card" role="dialog" aria-modal="false" aria-labelledby="tour-title" tabindex="-1">
  <div class="tour-card-in">
    ... existing children unchanged ...
  </div>
</div>
```

```css
.tour-card {
  position: fixed; left: 0; top: 0;
  width: min(320px, calc(100vw - 24px));
  pointer-events: auto;
  transition: transform var(--med) var(--ease-out);
}
.tour-card-in {
  background: var(--panel); border: 1px solid var(--ink);
  padding: var(--s4) var(--s4) var(--s3);
  opacity: 0; transform: scale(0.985);
  transition: opacity var(--med) var(--ease-out), transform var(--med) var(--ease-out);
}
.tour.is-in .tour-card-in { opacity: 1; transform: none; }
.tour.is-out .tour-card-in { opacity: 0; }
```

```ts
card.style.transform =
  `translate3d(${Math.max(12, Math.min(vw - cw - 12, x))}px, ` +
  `${Math.max(12, Math.min(vh - ch - 12, y))}px, 0)`;
```

Note `.tour-card` keeps `background`/`border`/`padding` **only** on the inner
element now — moving them is required, not optional, or the outer box will paint a
panel that never fades.

### 4. Gate the smooth scroll

```ts
// src/tour.ts:99
el?.scrollIntoView({
  block: 'nearest',
  behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
});
```

**Why these values:** `var(--med)` (200ms) and `var(--ease-out)` are unchanged —
this plan changes *which properties* animate, not the timing, which is already
correct for a moving on-screen element. `translate3d` rather than `translate`
because the z component is what reliably promotes the element to its own
compositor layer. `0.985` on the card entry is unchanged and already correct: a
near-full start reads as "it was always almost there", never `scale(0)`.

## Conventions to follow

- Easing and duration tokens are declared in `src/style.css:39-42`
  (`--ease-out: cubic-bezier(0.23, 1, 0.32, 1)`, `--fast: 140ms`, `--med: 200ms`).
  Use the tokens; do not inline a raw curve and do not add a new token.
- `src/slider.ts:117-121` is the exemplar for writing transforms from TypeScript —
  it composes a full `translate3d(...)` string and assigns `style.transform`
  directly rather than driving a CSS custom property. Match that.
- Comments in this repo explain *why*, in prose, and are written in full sentences.
  Match `src/tour.ts:86-88` for tone.

## Steps

1. In `src/tour.ts`, add `<div class="tour-dim" aria-hidden="true"></div>` as the
   first child of the `.tour` markup, before `.tour-spot`.
2. Wrap the existing children of `.tour-card` in `<div class="tour-card-in">`.
3. Query the new elements alongside the existing `spot`/`card` queries.
4. Rewrite the four `spot.style.*` assignments in `place()` as the `clipPath` on
   `.tour-dim` plus `transform` + `width`/`height` on `.tour-spot`.
5. Rewrite the two `card.style.*` assignments as a single `transform`.
6. Gate `scrollIntoView`'s `behavior` on reduced motion.
7. In `src/style.css`, replace the `.tour-spot` and `.tour-card` rules as above and
   add `.tour-dim` and `.tour-card-in`.
8. Check the existing reduced-motion override at `src/style.css:1133`
   (`.tour-spot, .tour-card { transition-duration: 0.01ms; }`) still names elements
   that exist; extend it to `.tour-dim` and `.tour-card-in`.

## Out of scope

- Do not change the six-step `TOUR` array in `src/main.ts:709-742`, its copy, or
  its ordering.
- Do not change the tour's keyboard handling, focus management, or the
  `localStorage` seen-flag.
- Do not change `place()`'s side-selection logic (the `bottom`/`top`/`right`/`left`
  flipping) — only the lines that write styles.
- Do not touch any other component's timing.
- Do not introduce an animation library.

## Verification

**Build**
- [ ] `npx tsc --noEmit` passes.
- [ ] `npx vite build` succeeds.

**Behavior**
- [ ] Press **Walkthrough** in the header. All six steps highlight the correct
      element, and the card stays inside the viewport at 1440×900 and at 900×700.
- [ ] The dim covers the viewport with exactly one rectangular hole, and the hole
      lands on the same element the 1px acid ring surrounds — no offset between them.
- [ ] Click **Next** rapidly. The hole and the ring retarget from where they are;
      neither restarts from a corner.
- [ ] Resize the window mid-tour: `place()` still lands the hole correctly.
- [ ] With `prefers-reduced-motion: reduce` emulated, the spotlight jumps between
      steps with no travel, the page does not smooth-scroll, and the card still
      fades.

**Performance**
- [ ] Record a Performance profile in DevTools while clicking through all six steps.
      Before this change the step transition shows Paint work proportional to the
      viewport; after it, the step should show Composite only. If Paint still
      appears, the box-shadow was left on `.tour-spot`.

**Feel**
- [ ] Record the step transition and scrub frame by frame. The hole and the ring
      must move as one object — if they separate by even a frame, their transition
      durations have drifted apart.
- [ ] Look at it again with fresh eyes before calling it done.

## Notes

The ten-point polygon is the load-bearing detail. If a future step ever needs a
non-rectangular highlight, the point count must stay at ten or `clip-path` will
snap instead of interpolating.

Whether the hole should have rounded corners is a taste call this audit cannot make
from code. The rest of the interface is hairlines and hard corners, so square is the
consistent choice, but it is worth looking at once on screen.
