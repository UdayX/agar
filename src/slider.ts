/**
 * Slider.
 *
 * Built rather than borrowed because the native range input cannot do the two
 * things that make a control feel physical:
 *
 *   1. 1:1 tracking that respects where you grabbed the thumb. Dragging never
 *      goes through a spring — the handle is glued to the pointer.
 *   2. Interruptible settle. Clicking the track commits the value instantly and
 *      springs the handle there from wherever it currently is, so grabbing it
 *      mid-flight picks it up at its on-screen position instead of jumping.
 *
 * Spring is critically damped (no overshoot) with a 0.32 s response — Apple's
 * default for a reposition. Reduced motion skips it entirely.
 *
 * Accessibility is not traded away for this: the element is a real
 * `role="slider"` with full arrow / Page / Home / End handling, live
 * `aria-valuetext`, and it is labelled and described by the same nodes the
 * native control would have used.
 */

const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');

interface Spring { x: number; v: number; target: number; apply: (x: number) => void; }
const springs = new Set<Spring>();
let raf = 0;

function tickSprings(): void {
  raf = 0;
  const dt = 1 / 60;
  const omega = (2 * Math.PI) / 0.32;      // response
  const k = omega * omega;
  const c = 2 * omega;                     // damping ratio 1.0 — settles, never overshoots
  for (const s of springs) {
    s.v += (-k * (s.x - s.target) - c * s.v) * dt;
    s.x += s.v * dt;
    if (Math.abs(s.x - s.target) < 0.0004 && Math.abs(s.v) < 0.004) {
      s.x = s.target; s.v = 0;
      s.apply(s.x);
      springs.delete(s);
      continue;
    }
    s.apply(s.x);
  }
  if (springs.size) raf = requestAnimationFrame(tickSprings);
}
const kick = () => { if (!raf && springs.size) raf = requestAnimationFrame(tickSprings); };

export interface SliderOpts {
  min: number; max: number; step: number;
  value: number;
  labelId: string;
  describedBy?: string;
  format: (v: number) => string;
  onInput: (v: number) => void;
}

export class Slider {
  readonly el: HTMLDivElement;
  private fill: HTMLDivElement;
  private thumb: HTMLDivElement;
  private o: SliderOpts;
  private value: number;
  private display: number;                 // presentation value, 0–1
  private spring: Spring;
  private dragging = false;
  private grabDx = 0;

  constructor(o: SliderOpts) {
    this.o = o;
    this.value = o.value;
    this.display = this.norm(o.value);

    this.el = document.createElement('div');
    this.el.className = 'sl';
    this.el.tabIndex = 0;
    this.el.setAttribute('role', 'slider');
    this.el.setAttribute('aria-labelledby', o.labelId);
    if (o.describedBy) this.el.setAttribute('aria-describedby', o.describedBy);
    this.el.setAttribute('aria-valuemin', String(o.min));
    this.el.setAttribute('aria-valuemax', String(o.max));

    const track = document.createElement('div');
    track.className = 'sl-track';
    this.fill = document.createElement('div');
    this.fill.className = 'sl-fill';
    this.thumb = document.createElement('div');
    this.thumb.className = 'sl-thumb';
    track.append(this.fill);
    this.el.append(track, this.thumb);

    this.spring = { x: this.display, v: 0, target: this.display, apply: (x) => this.paint(x) };

    this.el.addEventListener('pointerdown', this.onDown);
    this.el.addEventListener('keydown', this.onKey);
    this.paint(this.display);
    this.aria();
  }

  private norm(v: number): number {
    return (v - this.o.min) / (this.o.max - this.o.min);
  }

  private quantise(t: number): number {
    const { min, max, step } = this.o;
    const raw = min + t * (max - min);
    const snapped = Math.round(raw / step) * step;
    return Math.min(max, Math.max(min, Number(snapped.toFixed(6))));
  }

  /** Thumb width comes from CSS — it grows on coarse pointers. */
  private tw(): number { return this.thumb.offsetWidth || 11; }

  private paint(t: number): void {
    const w = this.el.clientWidth || 1;
    this.fill.style.transform = `scaleX(${Math.max(0, Math.min(1, t))})`;
    this.thumb.style.transform = `translate3d(${t * (w - this.tw())}px, -50%, 0)`;
  }

  private aria(): void {
    this.el.setAttribute('aria-valuenow', String(this.value));
    this.el.setAttribute('aria-valuetext', this.o.format(this.value));
  }

  /** Commit a value. `settle` springs the handle; drags paint directly. */
  private commit(v: number, settle: boolean): void {
    if (v !== this.value) {
      this.value = v;
      this.aria();
      this.o.onInput(v);
    }
    const t = this.norm(v);
    if (settle && !reduced.matches) {
      this.spring.target = t;
      springs.add(this.spring);
      kick();
    } else {
      springs.delete(this.spring);
      this.spring.x = t; this.spring.v = 0; this.spring.target = t;
      this.paint(t);
    }
  }

  private tFromEvent(e: PointerEvent, useGrab: boolean): number {
    const tw = this.tw();
    const r = this.el.getBoundingClientRect();
    const x = e.clientX - r.left - (useGrab ? this.grabDx : tw / 2);
    return Math.min(1, Math.max(0, x / Math.max(1, r.width - tw)));
  }

  private onDown = (e: PointerEvent): void => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    this.el.setPointerCapture(e.pointerId);
    this.el.classList.add('is-active');
    this.dragging = true;

    // Respect where the thumb was grabbed; snapping it to the pointer centre
    // breaks the illusion the moment you touch it.
    const tw = this.tw();
    const r = this.el.getBoundingClientRect();
    const thumbX = this.norm(this.value) * (r.width - tw);
    const localX = e.clientX - r.left;
    const onThumb = Math.abs(localX - (thumbX + tw / 2)) <= tw + 6;
    this.grabDx = onThumb ? localX - thumbX : tw / 2;

    // A press away from the thumb is a jump: commit now, let the handle travel.
    this.commit(this.quantise(this.tFromEvent(e, true)), !onThumb);

    this.el.addEventListener('pointermove', this.onMove);
    this.el.addEventListener('pointerup', this.onUp);
    this.el.addEventListener('pointercancel', this.onUp);
    e.preventDefault();
  };

  private onMove = (e: PointerEvent): void => {
    if (!this.dragging) return;
    this.commit(this.quantise(this.tFromEvent(e, true)), false);
  };

  private onUp = (e: PointerEvent): void => {
    this.dragging = false;
    this.el.classList.remove('is-active');
    this.el.releasePointerCapture?.(e.pointerId);
    this.el.removeEventListener('pointermove', this.onMove);
    this.el.removeEventListener('pointerup', this.onUp);
    this.el.removeEventListener('pointercancel', this.onUp);
  };

  private onKey = (e: KeyboardEvent): void => {
    const { min, max, step } = this.o;
    const big = (max - min) / 10;
    let v: number | null = null;
    switch (e.key) {
      case 'ArrowLeft': case 'ArrowDown': v = this.value - step; break;
      case 'ArrowRight': case 'ArrowUp': v = this.value + step; break;
      case 'PageDown': v = this.value - big; break;
      case 'PageUp': v = this.value + big; break;
      case 'Home': v = min; break;
      case 'End': v = max; break;
      default: return;
    }
    e.preventDefault();
    // Keyboard steps are repeated quickly; springing them would lag the key.
    this.commit(this.quantise(this.norm(Math.min(max, Math.max(min, v)))), false);
  };

  /** External update (preset load, species change, reset). */
  set(v: number): void {
    this.value = Math.min(this.o.max, Math.max(this.o.min, v));
    this.aria();
    this.commitVisualOnly();
  }

  private commitVisualOnly(): void {
    const t = this.norm(this.value);
    springs.delete(this.spring);
    this.spring.x = t; this.spring.v = 0; this.spring.target = t;
    this.paint(t);
  }

  /** Re-place the handle after a layout change. */
  reflow(): void { this.paint(this.spring.x); }
}
