# Animation plans

Audited at commit `a048954` against the *Animations on the Web* bar
([animations.dev](https://animations.dev/)).

The motion in this repo is mostly already right. Easing and duration tokens are
declared once (`src/style.css:39-42`) and used consistently, every `:hover` is gated
behind `@media (hover: hover) and (pointer: fine)`, reduced motion is handled in six
places, and the slider's spring (`src/slider.ts:18-45`) is critically damped, writes
transforms directly rather than through CSS variables, and drags 1:1 with no spring
in the loop — which is exactly what the rules prescribe. What follows is five gaps,
not a rewrite.

## Execution order

| # | Plan | Severity | Depends on | Status |
| --- | --- | --- | --- | --- |
| 001 | [Move the walkthrough spotlight and card off layout properties](001-tour-off-layout-properties.md) | HIGH | — | **DONE** `d2eac25` |
| 002 | [Let the organism panel close the way it opened](002-organism-detail-exit.md) | MEDIUM | — | **DONE** |
| 003 | [Make every card's live handoff arrive and leave the same way](003-card-handoff-symmetry.md) | MEDIUM | 002 | **DONE** |
| 004 | [Press feedback on the last two controls, and confirmation on export](004-press-and-confirm-feedback.md) | MEDIUM | — | TODO |
| 005 | [A chemotactic cursor: the pointer as an attractant source](005-chemotactic-cursor.md) | — (additive) | — | TODO |

**Dependency:** 003 touches `goLive`/`goStill` in `src/learn.ts`, and 002 touches
`closeDetail()` in the same file. Land 002 first so the second edit applies to
settled code. Nothing else overlaps — 001 is `tour.ts`, 004 is `main.ts`, 005 is a
new file.

**Recommended order:** 001 (the only performance defect), then 002 → 003 as a pair,
then 004, then 005 last — it is the only additive one, and it is the only one whose
right answer might be "don't ship it".

## Rejected findings

Recorded so they are not re-raised.

- **`@keyframes pane-in` on rail tab panels** (`src/style.css:774-777`). Exempt: the
  panes are `display: none` between switches, so a transition cannot run at all, and
  a restarting keyframe is correct rather than the Sonner bug. Also already gated on
  both reduced motion and the low performance tier.
- **The story band's 620ms reveal and 70ms stagger** (`src/style.css:927-933`).
  Exempt: it is a scroll-triggered reveal on the narrative band, which is the page's
  packaging, and long one-shot intros are legitimate there. The delays sit inside the
  30–80ms band.
- **Infinite loops under `prefers-reduced-motion`** (`sweep`, `blip`, `drift`). Already
  handled deliberately at `src/style.css:727-735` — the sweep is removed, the drift is
  stopped, and the global `animation-iteration-count: 1` lands the pulse on a
  representative frame rather than frame zero.
- **Log entries appearing instantly** (`src/ui.ts:365`). Frequency: entries arrive
  continuously while a culture runs, and permanent motion beside a growth curve is a
  defect, not a polish item.
- **The inspect probe appearing instantly** (`src/style.css:466`). Function: it tracks
  the pointer and reports one cell's state; any entry transition puts latency between
  the pointer and the number it exists to deliver.
- **No press state on rail tabs** (`src/style.css:758`). Purpose: `.tab-ind` already
  slides to the pressed tab. A second acknowledgement of one event is noise.
- **The Incubate ⇄ Pause label swap** (`src/main.ts:255`). Frequency: the transport is
  the most-used control in the app and is often driven by keyboard.
