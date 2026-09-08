# 002 — Let the organism panel close the way it opened

- **Commit:** a048954
- **Severity:** MEDIUM
- **Category:** 7 — Cohesion & spatial consistency
- **Estimated scope:** 1 file, ~12 lines

## Problem

The organism detail panel has a 260ms enter transition — it slides 14px from the
right and fades up — and a matching exit transition defined in CSS that **can never
run**. `closeDetail()` removes the `is-in` class and sets `hidden = true` on the
same tick, so the browser never gets a frame in which the exit state is rendered.
The panel slides in and then vanishes.

The rule: when something enters from a direction, the user's mental model is "this
lives over there". Disappearing contradicts it. Exits should also be *shorter* than
entrances — the user has already decided to dismiss, so the system should get out
of the way faster than it arrived.

## Where

| File | Lines | What's there |
| --- | --- | --- |
| `src/learn.ts` | 218–229 | `closeDetail()` — tears down synchronously |
| `src/style.css` | 1056–1064 | `.od-panel` — the enter transition |

### Current code

```ts
// src/learn.ts:218
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
```

```css
/* src/style.css:1056 */
.od-panel {
  position: relative; z-index: 1;
  width: min(720px, 100%); height: 100%;
  overflow-y: auto; overscroll-behavior: contain;
  background: var(--panel); border-left: 1px solid var(--ink);
  transform: translateX(14px); opacity: 0;
  transition: transform 260ms var(--ease-out), opacity 260ms var(--ease-out);
}
.org-detail.is-in .od-panel { transform: none; opacity: 1; }
```

## Target

Add an `is-out` state that shortens the transition, and delay the teardown until it
has played.

```css
.org-detail.is-out .od-panel {
  transform: translateX(14px); opacity: 0;
  transition: transform 180ms var(--ease-out), opacity 180ms var(--ease-out);
}
.org-detail.is-out .od-scrim { opacity: 0; transition: opacity 180ms var(--ease-out); }
```

```ts
function closeDetail(push = true): void {
  if (!detailOpen) return;
  detailOpen = false;
  // Focus and history move now — the panel is already gone as far as the user is
  // concerned, and waiting 180ms to hand focus back would be felt as a stall.
  document.body.classList.remove('is-locked');
  if (push && location.hash) history.pushState(null, '', location.pathname);
  lastFocus?.focus();

  detail.classList.remove('is-in');
  detail.classList.add('is-out');

  // Leaving is the reverse of arriving, so the teardown waits for it. Not on a
  // transitionend listener: a tab in the background gets no transitions, and the
  // panel would then never be torn down at all.
  const done = (): void => {
    if (detailOpen) return;              // reopened during the exit — leave it alone
    detail.classList.remove('is-out');
    detail.hidden = true;
    detail.innerHTML = '';
    viewer.stop();
    viewer.el.remove();
  };
  if (reduced) done(); else setTimeout(done, 180);
}
```

**Why these values:** 180ms against the 260ms entrance is the asymmetry the rule
asks for — roughly two-thirds, enough to read as deliberate without feeling
truncated. `translateX(14px)` is unchanged and matches the entrance exactly, which
is the whole point: it must leave through the edge it came from. `var(--ease-out)`
is unchanged. The `detailOpen` re-check in `done()` is what makes a rapid
close-then-open safe.

## Conventions to follow

- Tokens live in `src/style.css:39-42`. `260ms` and `180ms` are already written as
  literals on `.od-panel` because they sit outside the `--fast`/`--med` scale; keep
  that local style rather than adding tokens for two one-off values.
- `src/main.ts:757-761` is the exemplar for "animate out, then hide": it adds an
  `is-out` class, sets a `setTimeout` matched to the CSS duration, and short-circuits
  the timeout under reduced motion. Match that structure exactly.
- `reduced` is already in scope in `src/learn.ts:22` as a boolean.

## Steps

1. Add the two `.org-detail.is-out` rules to `src/style.css`, immediately after the
   existing `.org-detail.is-in .od-panel` rule.
2. Rewrite `closeDetail()` in `src/learn.ts` as above.
3. Confirm the reduced-motion block at `src/style.css:1135`
   (`.od-panel { transition-duration: 0.01ms; }`) still applies — it uses the bare
   `.od-panel` selector, which the new `.is-out` rule overrides by specificity, so
   the `reduced ? done() : setTimeout(...)` branch in TypeScript is what actually
   carries reduced motion here. Do not rely on the CSS alone.

## Out of scope

- Do not change `openDetail()`, its 260ms entrance, or the `void detail.offsetWidth`
  layout flush at `src/learn.ts:206`.
- Do not change the hash routing or the `popstate` handler.
- Do not change `.od-scrim`'s `backdrop-filter`.
- Do not touch the card hover handoff — that is plan 003.

## Verification

**Build**
- [ ] `npx tsc --noEmit` passes.

**Behavior**
- [ ] Open an organism, press Escape. The panel slides back out to the right and
      fades; it does not vanish.
- [ ] Open, then close, then immediately open the same organism before the exit
      finishes. The panel must end up open and populated — not blank, not
      half-faded.
- [ ] Close with the scrim, with the header close button, and with the browser
      back button. All three animate.
- [ ] Focus returns to the card that was opened, immediately, not after 180ms.
- [ ] With `prefers-reduced-motion: reduce`, the panel closes instantly with no
      travel and nothing is left in the DOM.

**Feel**
- [ ] Record the open and the close back to back and scrub. The exit should read as
      clearly quicker than the entrance without looking clipped.

## Notes

Whether 180ms is the right exit against a 260ms entrance is the one judgement here
that code cannot settle. Two-thirds is the conventional starting point; if the exit
reads as abrupt on a 720px panel, 200ms is the next value to try, not 240ms.
