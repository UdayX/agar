/** Instruments. Two small plots, drawn from the same samples the CSV exports. */
import type { Sim } from './sim';

const INK = '#111111', GREY = '#8a8a82', LINE = '#e6e6e0', ACID = '#ccff00';

function frame(cv: HTMLCanvasElement): { c: CanvasRenderingContext2D; w: number; h: number } | null {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = cv.clientWidth || 260, h = cv.clientHeight || 96;
  if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) {
    cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
  }
  const c = cv.getContext('2d');
  if (!c) return null;
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  c.clearRect(0, 0, w, h);
  c.font = '9px ui-monospace, SFMono-Regular, Menlo, monospace';
  return { c, w, h };
}

function grid(c: CanvasRenderingContext2D, w: number, h: number, pad: number): void {
  c.strokeStyle = LINE; c.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const y = pad + ((h - pad * 2) * i) / 4;
    c.beginPath(); c.moveTo(pad, y + 0.5); c.lineTo(w - pad, y + 0.5); c.stroke();
  }
}

export function drawGrowth(cv: HTMLCanvasElement, sim: Sim): void {
  const f = frame(cv);
  if (!f) return;
  const { c, w, h } = f;
  const pad = 12;
  grid(c, w, h, pad);
  const s = sim.samples;
  if (s.length < 2) return;

  const tMax = Math.max(1, s[s.length - 1].t);
  const popMax = Math.max(10, sim.peakPop);
  const x = (t: number) => pad + ((w - pad * 2) * t) / tMax;
  const yPop = (p: number) => h - pad - (h - pad * 2) * (Math.log10(Math.max(1, p)) / Math.log10(popMax));
  const subMax = Math.max(1e-6, s[0].sub);
  const ySub = (v: number) => h - pad - (h - pad * 2) * Math.min(1, v / subMax);

  // substrate, dashed
  c.strokeStyle = GREY; c.lineWidth = 1; c.setLineDash([2, 3]);
  c.beginPath();
  s.forEach((p, i) => (i ? c.lineTo(x(p.t), ySub(p.sub)) : c.moveTo(x(p.t), ySub(p.sub))));
  c.stroke();
  c.setLineDash([]);

  // population, log scale
  c.strokeStyle = INK; c.lineWidth = 1.5;
  c.beginPath();
  s.forEach((p, i) => (i ? c.lineTo(x(p.t), yPop(p.pop)) : c.moveTo(x(p.t), yPop(p.pop))));
  c.stroke();

  // current head
  const last = s[s.length - 1];
  c.fillStyle = ACID;
  c.strokeStyle = INK;
  c.beginPath(); c.arc(x(last.t), yPop(last.pop), 3, 0, 6.283); c.fill(); c.stroke();

  c.fillStyle = GREY;
  c.fillText(`${(tMax / 60).toFixed(1)} h`, w - pad - 26, h - 2);
  c.fillText(`N ${popMax}`, pad, 9);
}

export function drawTraits(cv: HTMLCanvasElement, sim: Sim): void {
  const f = frame(cv);
  if (!f) return;
  const { c, w, h } = f;
  const pad = 12;
  grid(c, w, h, pad);
  const s = sim.samples;
  if (s.length < 2) return;

  const tMax = Math.max(1, s[s.length - 1].t);
  const x = (t: number) => pad + ((w - pad * 2) * t) / tMax;
  const norm = (key: 'mu' | 'speed' | 'res') => {
    let max = 1e-6;
    for (const p of s) max = Math.max(max, p[key]);
    return (v: number) => h - pad - (h - pad * 2) * Math.min(1, v / max);
  };

  const series: [('mu' | 'speed' | 'res'), string, number[]][] = [
    ['mu', INK, []], ['speed', GREY, [2, 3]], ['res', ACID, []],
  ];
  for (const [key, colour, dash] of series) {
    const y = norm(key);
    c.setLineDash(dash);
    c.lineWidth = key === 'res' ? 2 : 1.5;
    c.strokeStyle = colour;
    if (key === 'res') { c.lineWidth = 3; c.strokeStyle = ACID; }
    c.beginPath();
    s.forEach((p, i) => (i ? c.lineTo(x(p.t), y(p[key])) : c.moveTo(x(p.t), y(p[key]))));
    c.stroke();
    if (key === 'res') {                       // acid is thin on white — outline it
      c.setLineDash([]);
      c.lineWidth = 0.5; c.strokeStyle = GREY;
      c.beginPath();
      s.forEach((p, i) => (i ? c.lineTo(x(p.t), y(p[key])) : c.moveTo(x(p.t), y(p[key]))));
      c.stroke();
    }
  }
  c.setLineDash([]);
  c.fillStyle = GREY;
  c.fillText('normalised to each trait’s own maximum', pad, 9);
}
