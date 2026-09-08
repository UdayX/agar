# 003 — Make every card's live handoff arrive and leave the same way

- **Commit:** a048954
- **Severity:** MEDIUM
- **Category:** 7 — Cohesion & spatial consistency
- **Estimated scope:** 2 files, ~25 lines

## Problem

Two defects in the same interaction — the still-to-live handoff that is the Learn
page's signature gesture.

**One: it enters smoothly and leaves by cutting.** `goLive()` appends the shared
WebGL canvas over the card's still thumbnail and calls `viewer.zoom(1.16)`, which
the renderer eases toward over ~20 frames. `goStill()` calls `viewer.stop()` and
`viewer.el.remove()` on the same tick, so the live canvas is torn away while it is
still at zoom 1.16 and the 1.0 still snaps back underneath. The organism jumps.

**Two: only the first card ever animates.** `zoomNow` is module state on a single
shared viewer. `stop()` freezes it at 1.16, and the next `goLive()` sets
`zoomTo = 1.16` — a target it is already at. So the first card the pointer touches
zooms in, and every card after it appears pre-zoomed. The same gesture produces two
different results depending on history.

## Where

| File | Lines | What's there |
| --- | --- | --- |
| `src/learn.ts` | 105–116 | `goLive()` |
| `src/learn.ts` | 118–124 | `goStill()` |
| `src/organism3d.ts` | 329 | `let zoomNow = 1, zoomTo = 1;` |
| `src/organism3d.ts` | 354 | `zoomNow += (zoomTo - zoomNow) * 0.10;` |
| `src/organism3d.ts` | 391 | `zoom(z) { zoomTo = z; },` |
| `src/style.css` | 1020 | `.viz` — the live canvas, absolutely positioned over the still |

### Current code

```ts
// src/learn.ts:105
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
```

```css
/* src/style.css:1020 */
.viz { position: absolute; z-index: 1; touch-action: none; cursor: grab; }
```

## Target

### 1. A way to reset the zoom without animating to it

Add one method to the `Viewer` interface so `learn.ts` can snap the zoom rather
than ease to it.

```ts
// src/organism3d.ts — in `export interface Viewer`
  zoom(z: number): void;
  /** Jump the zoom with no easing — for handing the viewer to a new host. */
  setZoom(z: number): void;
```

WebGL implementation, alongside `zoom(z)`:

```ts
    setZoom(z) { zoomTo = z; zoomNow = z; },
```

Fallback implementation, alongside the other no-ops at `src/organism3d.ts:454`:

```ts
    zoom() {}, setZoom() {}, spin() {}, start() {}, stop() {}, quality() {},
```

### 2. Enter from 1.0 every time, leave by zooming back

```ts
const LIVE_ZOOM = 1.16;
const HANDOFF = 160;                     // ms; matches the CSS bridge below
let leaving = 0;                         // pending goStill teardown

function goLive(id: string): void {
  if (liveOn === id || detailOpen) return;
  const card = cards.get(id);
  const stage = card?.querySelector('.org-stage') as HTMLElement | undefined;
  if (!stage) return;
  clearTimeout(leaving);
  liveOn = id;
  stage.appendChild(viewer.el);
  viewer.size(THUMB, THUMB);
  viewer.show(loreById(id)!.form);
  // Snap to the still's scale first, then ease up — otherwise the second card
  // the pointer touches inherits the first one's zoom and never animates.
  viewer.setZoom(1);
  viewer.zoom(LIVE_ZOOM);
  if (!reduced) viewer.start();
  viewer.el.classList.remove('is-leaving');
  void viewer.el.offsetWidth;            // flush, so the entry transition runs
  viewer.el.classList.add('is-live');
}

function goStill(): void {
  if (!liveOn || detailOpen) return;
  liveOn = null;
  // Leave the way it arrived: ease the zoom back down and let the loop render it,
  // then detach. Not on transitionend — a backgrounded tab fires no transitions
  // and the canvas would never be released.
  viewer.zoom(1);
  viewer.el.classList.remove('is-live');
  viewer.el.classList.add('is-leaving');
  const detach = (): void => {
    if (liveOn) return;                  // a new card claimed it mid-exit
    viewer.stop();
    viewer.setZoom(1);
    viewer.el.classList.remove('is-leaving');
    viewer.el.remove();
  };
  if (reduced) detach(); else leaving = window.setTimeout(detach, HANDOFF);
}
```

### 3. A blur bridge, so two renders of the same organism read as one

```css
.viz {
  position: absolute; z-index: 1; touch-action: none; cursor: grab;
}
.org-stage .viz {
  opacity: 0; filter: blur(3px);
  transition: opacity 160ms var(--ease-out), filter 160ms var(--ease-out);
}
.org-stage .viz.is-live { opacity: 1; filter: blur(0); }
.org-stage .viz.is-leaving { opacity: 0; filter: blur(3px); }
html[data-perf="low"] .org-stage .viz { filter: none; transition: opacity 160ms var(--ease-out); }
@media (prefers-reduced-motion: reduce) {
  .org-stage .viz { transition-duration: 0.01ms; filter: none; }
}
```

The `.org-stage` prefix keeps all of this off the detail view's copy of `.viz`
(`src/style.css:1082`), which is a different host with its own sizing.

**Why these values:** 160ms because the two images are the *same organism* at
1.0 and 1.16 — the eye has almost nothing to reconcile, so anything longer reads as
sluggish on a hover. `3px` of blur is the documented amount for bridging a crossfade
that otherwise reads as two distinct objects; it stays far under the ~20px where
blur becomes expensive. `blur(0)` rather than `none` so the property interpolates.
`1.16` is unchanged — it is the existing hover zoom and this plan does not
re-litigate it.

## Conventions to follow

- `src/main.ts:757-761` is the exemplar for "animate out, then tear down": add a
  class, `setTimeout` matched to the CSS duration, short-circuit under reduced
  motion. Match it.
- The repo forces layout with `void el.offsetWidth` before adding an entry class —
  see `src/learn.ts:206` and `src/tour.ts:136`. It does this deliberately instead of
  `requestAnimationFrame`, because a backgrounded tab gets no frames. Use the same
  idiom; do **not** replace it with `requestAnimationFrame`.
- Tokens live in `src/style.css:39-42`.

## Steps

1. Add `setZoom(z: number): void` to the `Viewer` interface in `src/organism3d.ts`.
2. Implement it in the WebGL viewer (`zoomTo = z; zoomNow = z;`) and add a no-op to
   the flat fallback's method list.
3. Rewrite `goLive()` and `goStill()` in `src/learn.ts` as above, adding the
   `LIVE_ZOOM`, `HANDOFF` and `leaving` module constants near the existing `THUMB`.
4. Add the `.org-stage .viz` rules to `src/style.css` next to the existing `.viz`
   rule.
5. Verify the detail view still works: `openDetail()` also appends `viewer.el`, into
   `#od-stage`, which is **not** inside `.org-stage` — so none of the new rules
   apply there and its canvas must remain fully opaque.

## Out of scope

- Do not change `THUMB`, the quality tiers, or `CELLS`/`STEPS` in
  `src/organism3d.ts`.
- Do not change `openDetail()` / `closeDetail()` — that is plan 002.
- Do not change the still-thumbnail generation in `makeStills()`.
- Do not add a second WebGL context. One shared viewer is a deliberate constraint;
  nine live contexts would exhaust the browser's budget.

## Verification

**Build**
- [ ] `npx tsc --noEmit` passes — the interface change will fail the build if either
      implementation is missed.

**Behavior**
- [ ] Hover card 1, then card 5, then card 9. **All three** zoom in from the still's
      scale. Before this change only the first one does.
- [ ] Move the pointer off a card. The organism eases back down to the still's scale
      and the swap is invisible; there is no jump.
- [ ] Sweep the pointer quickly across all nine cards. The viewer follows without
      leaving a canvas orphaned on a card, and without ever going blank.
- [ ] Tab through the cards with the keyboard — `focusin`/`focusout` drive the same
      two functions and must behave identically.
- [ ] Open a card's detail view. The large viewer is fully opaque and unblurred.
- [ ] With `prefers-reduced-motion: reduce`, the live canvas does not spin and the
      handoff is instant.
- [ ] With Performance set to Low in the right rail, the blur is gone and the
      opacity crossfade remains.

**Feel**
- [ ] Record one hover-on and hover-off at 4× slowdown and scrub. The question is
      binary: does it read as one organism getting closer, or as two pictures
      swapping? If it is still two, raise the blur to 5px before touching the
      duration.

## Notes

The blur amount is the one value here that genuinely cannot be judged from code.
Two renders of the same shape at 1.0 and 1.16 may need almost no bridging, or the
dither pattern shifting between the two may make the seam obvious. Record it before
settling on 3px.

---

## Corrected after implementation

The `detach()` guard specified here checked only `liveOn`. It also has to check
`detailOpen`: opening an organism from the keyboard or a hash change inside the
160ms handoff window would otherwise fire the pending detach and rip the shared
canvas out of the panel it had just been handed to. The guard is now
`if (liveOn || detailOpen) return;`. This is the same mistake plan 002 warned
about and this plan then made — worth remembering that a single shared canvas
has exactly two possible owners, and every deferred teardown has to check both.

