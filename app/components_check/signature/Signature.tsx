"use client";
/* eslint-disable react-hooks/refs, react-hooks/purity -- kept as the author wrote it: strokes live in a ref, redraw() re-renders, handlers read the clock */
import { useEffect, useRef, useState } from "react";
import { Check } from "lucide-react";
import { useSettings } from "../../../lib/settings";
import "./Signature.css";

/* ══ Signature pad ════════════════════════════════════════
   Sign on the line. The ink thins as the pen moves faster and
   pools as it slows, the way a real nib does.

   Pause after the last stroke and the pad folds itself into a
   small pill that says Signed. Press the pill to sign again.
   Clear does not wipe: the ink un-draws, last point first.
   SVG, not a canvas: crisp at any scale, ink is currentColor.

   Idle (added): left empty for a few seconds, a faint flourish
   writes itself on the line and rewinds, over and over, until
   a pen touches the pad. */

/* the pen lifts: the ink softens this soon after, and the pad folds
   away at FOLD_MS if the pen has not come back. A new stroke in
   between brings the ink straight back to full strength */
const SOFT_MS = 220;
const FOLD_MS = 1500;
const W = 300;
const H = 180;
/* where the line is, in the block's own pixels */
const LINE_Y = 128;
const INSET = 28;
/* what the pad folds into */
const PILL_W = 112;
const PILL_H = 40;
/* idle: how long the empty pad waits, and the beats of the flourish */
const IDLE_WAIT = 3000;
const IDLE_WRITE = 1700;
const IDLE_HOLD = 900;
const IDLE_REWIND = 800;
const IDLE_GAP = 1600;

type Pt = { x: number; y: number; w: number };

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const ease = (k: number) => (k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2);

/* the idle flourish: a looping cursive scribble with a closing swash, widths from the same
   rule as the nib (fast is thin) so it reads as written, not traced */
const GHOST: Pt[] = (() => {
  const pts: { x: number; y: number }[] = [];
  const n = 150;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    pts.push({
      x: 44 + t * 200 + 16 * Math.sin(t * 24),
      y: LINE_Y - 22 - 26 * Math.cos(t * 24) * (1 - 0.35 * t) - 10 * t,
    });
  }
  for (let i = 1; i <= 24; i++) { /* the swash underneath */
    const t = i / 24;
    pts.push({ x: 244 - t * 170, y: LINE_Y - 18 + 12 * Math.sin(t * Math.PI) });
  }
  return pts.map((p, i) => {
    const d = i ? Math.hypot(p.x - pts[i - 1].x, p.y - pts[i - 1].y) : 0;
    return { ...p, w: 4.2 - (4.2 - 1.4) * clamp(d / 7, 0, 1) };
  });
})();

/* one stroke as short quadratic pieces through the midpoints,
   each as wide as the pen was there */
function pieces(s: Pt[], upto: number, key: string) {
  const out: React.ReactNode[] = [];
  const n = Math.min(s.length, upto);
  if (n <= 0) return out;
  if (n === 1 || s.length === 1) {
    out.push(<circle key={key} cx={s[0].x} cy={s[0].y} r={s[0].w / 2} fill="currentColor" />);
    return out;
  }
  for (let i = 1; i < n; i++) {
    const a = s[i - 1];
    const b = s[i];
    const start = i === 1 ? a : { x: (s[i - 2].x + a.x) / 2, y: (s[i - 2].y + a.y) / 2 };
    const end = i === s.length - 1 ? b : { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    out.push(
      <path
        key={`${key}-${i}`}
        d={`M${start.x.toFixed(1)} ${start.y.toFixed(1)}Q${a.x.toFixed(1)} ${a.y.toFixed(1)} ${end.x.toFixed(1)} ${end.y.toFixed(1)}`}
        strokeWidth={((a.w + b.w) / 2).toFixed(2)}
      />,
    );
  }
  return out;
}

type Props = {
  /* how heavy the pen is, 0..100 */
  pen?: number;
  /* how much the hand's wobble is taken out, 0..100 */
  smooth?: number;
  ink?: string;
  /* how fast Clear un-draws, 0..100 */
  rewind?: number;
  corner?: number;
  /* the empty pad writes a faint flourish on its own: On / Off */
  idle?: string;
};

export function Signature(props: Props) {
  const g = useSettings().signature;
  const pen = props.pen ?? (g.pen as number);
  const smooth = props.smooth ?? (g.smooth as number);
  const ink = props.ink ?? (g.ink as string);
  const rewind = props.rewind ?? (g.rewind as number);
  const corner = props.corner ?? (g.corner as number);
  const idle = (props.idle ?? (g.idle as string)) === "On";

  const pad = useRef<HTMLDivElement>(null);
  const strokes = useRef<Pt[][]>([]);
  const [, setV] = useState(0);
  const redraw = () => setV((v) => v + 1);
  const [cut, setCut] = useState<number | null>(null);
  const [signed, setSigned] = useState(false);
  /* the beat between: the pause has said it is done, the ink has
     softened to a tint, and the pad has not yet folded away */
  const [settled, setSettled] = useState(false);
  const [ghost, setGhost] = useState(0); /* how much of the idle flourish is showing */
  const down = useRef(false);
  const last = useRef({ x: 0, y: 0, t: 0, w: 0 });
  const later = useRef(0);
  const raf = useRef(0);
  const knobs = useRef({ pen, smooth, rewind });
  knobs.current = { pen, smooth, rewind };

  const fold = useRef(0);
  useEffect(() => () => {
    clearTimeout(fold.current);
    clearTimeout(later.current);
    cancelAnimationFrame(raf.current);
  }, []);

  /* the pen's two widths, both of which move with the knob so
     neither end of it is a pen that cannot vary */
  const widths = () => {
    const p = clamp(knobs.current.pen, 0, 100) / 100;
    return { thin: 0.8 + p * 2, thick: 2.2 + p * 5 };
  };

  /* the pointer, in the block's own pixels — the block is drawn
     scaled on the wall and in the overlay */
  const local = (e: React.PointerEvent) => {
    const r = pad.current!.getBoundingClientRect();
    return { x: ((e.clientX - r.left) * W) / r.width, y: ((e.clientY - r.top) * H) / r.height };
  };

  const rewinding = cut !== null;
  const total = strokes.current.reduce((n, s) => n + s.length, 0);
  const inked = total > 0;

  /* ── idle: an empty, untouched pad writes, holds, rewinds, rests, again ──
     Runs only while nothing is inked and nobody is signing; a pen down ends it at once.
     Reduced motion gets no idle at all. */
  const quiet = idle && !inked && !signed && !rewinding;
  useEffect(() => {
    if (!quiet || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    let frame = 0;
    let t0 = 0;
    let wait = 0;
    const n = GHOST.length;
    const loop = (t: number) => {
      const e = t - t0;
      if (e < IDLE_WRITE) setGhost(Math.round(n * ease(e / IDLE_WRITE)));
      else if (e < IDLE_WRITE + IDLE_HOLD) setGhost(n);
      else if (e < IDLE_WRITE + IDLE_HOLD + IDLE_REWIND) setGhost(Math.round(n * (1 - ease((e - IDLE_WRITE - IDLE_HOLD) / IDLE_REWIND))));
      else if (e < IDLE_WRITE + IDLE_HOLD + IDLE_REWIND + IDLE_GAP) setGhost(0);
      else t0 = t;
      frame = requestAnimationFrame(loop);
    };
    wait = window.setTimeout(() => {
      t0 = performance.now();
      frame = requestAnimationFrame(loop);
    }, IDLE_WAIT);
    return () => {
      clearTimeout(wait);
      cancelAnimationFrame(frame);
      setGhost(0);
    };
  }, [quiet]);

  const onDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (rewinding || signed) return;
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* a scripted pointer */ }
    down.current = true;
    clearTimeout(later.current);
    clearTimeout(fold.current);
    setSigned(false);
    /* pen back on the pad before it folded: the ink comes back too */
    setSettled(false);
    const p = local(e);
    const { thin, thick } = widths();
    const w = (thin + thick) / 2;
    last.current = { ...p, t: performance.now(), w };
    strokes.current.push([{ ...p, w }]);
    redraw();
  };

  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!down.current) return;
    const raw = local(e);
    const l = last.current;
    /* smoothing: the pen follows the hand on a lag */
    const k = 1 - (clamp(knobs.current.smooth, 0, 100) / 100) * 0.75;
    const x = l.x + (raw.x - l.x) * k;
    const y = l.y + (raw.y - l.y) * k;
    const d = Math.hypot(x - l.x, y - l.y);
    if (d < 0.8) return;
    const t = performance.now();
    const v = d / Math.max(1, t - l.t);
    const { thin, thick } = widths();
    /* fast is thin, slow pools; and the width itself eases, so
       a single quick frame cannot make a notch in the line */
    const target = thick - (thick - thin) * clamp(v / 1.6, 0, 1);
    const w = l.w + (target - l.w) * 0.35;
    last.current = { x, y, t, w };
    strokes.current[strokes.current.length - 1].push({ x, y, w });
    redraw();
  };

  const onUp = (e: React.PointerEvent<HTMLDivElement>) => {
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch { /* never captured */ }
    if (!down.current) return;
    down.current = false;
    clearTimeout(later.current);
    clearTimeout(fold.current);
    fold.current = window.setTimeout(() => {
      if (!down.current && strokes.current.length) setSettled(true);
    }, SOFT_MS);
    later.current = window.setTimeout(() => {
      if (!down.current && strokes.current.length) {
        /* a pause after the last stroke is what signing IS: the
           softened ink shrinks away as the pad folds into the pill */
        setSigned(true);
      }
    }, FOLD_MS);
  };

  const clear = () => {
    if (!inked || rewinding) return;
    clearTimeout(later.current);
    clearTimeout(fold.current);
    setSigned(false);
    setSettled(false);
    const n = total;
    const per = 2 + ((100 - clamp(knobs.current.rewind, 0, 100)) / 100) * 8;
    const dur = clamp(n * per, 350, 2400);
    const t0 = performance.now();
    const step = (t: number) => {
      const k = Math.min(1, (t - t0) / dur);
      setCut(Math.round(n * (1 - ease(k))));
      if (k < 1) {
        raf.current = requestAnimationFrame(step);
        return;
      }
      strokes.current = [];
      setCut(null);
    };
    raf.current = requestAnimationFrame(step);
  };

  /* the pill, pressed: the ink goes while nobody can see it,
     and the pad opens back out empty */
  const again = () => {
    strokes.current = [];
    setSigned(false);
    setSettled(false);
  };

  /* draw up to the cut, stroke by stroke */
  const ink$: React.ReactNode[] = [];
  let left = cut ?? Infinity;
  strokes.current.forEach((s, i) => {
    if (left <= 0) return;
    ink$.push(...pieces(s, left, String(i)));
    left -= s.length;
  });

  const r = clamp(corner, 0, 28);
  /* the Clear pill sits 10 in: concentric once there is a curve */
  const inner = Math.max(0, r - 10 * Math.min(1, r / 20));

  return (
    /* a fixed frame, so folding into the pill never rescales
       the block on the wall */
    <div className="sig-frame" style={{ width: W, height: H }}>
    <div
      ref={pad}
      className="sig"
      data-ink={ink}
      data-has={inked || undefined}
      data-inked={(inked && !rewinding && !signed && !settled) || undefined}
      data-settled={(settled || signed) || undefined}
      data-signed={signed || undefined}
      style={{
        /* width and height, never a scale: the corner has to stay
           a corner all the way down to the pill */
        width: signed ? PILL_W : W,
        height: signed ? PILL_H : H,
        "--r": signed ? `${PILL_H / 2}px` : `${r}px`,
        "--inner": `${Math.min(14, inner)}px`,
      } as React.CSSProperties}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* everything drawn on the pad, on one layer centred in the
          card: signing, it shrinks with the card into the pill's
          middle instead of being cut off by its edges */}
      <div className="sig-face">
      <span className="sig-line" style={{ top: LINE_Y, left: INSET, right: INSET }} aria-hidden="true" />
      <span className="sig-hint" aria-hidden="true">Sign here</span>
      <svg
        className="sig-ink"
        viewBox={`0 0 ${W} ${H}`}
        width={W}
        height={H}
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        role="img"
        aria-label={inked ? "Signature" : "Empty signature pad"}
      >
        {ink$}
        {ghost > 0 && !inked && <g className="sig-ghost" aria-hidden="true">{pieces(GHOST, ghost, "g")}</g>}
      </svg>
      </div>
      <button
        type="button"
        className="sig-clear"
        tabIndex={inked && !rewinding && !signed && !settled ? 0 : -1}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={clear}
      >
        Clear
      </button>
      <span className="sig-said" aria-live="polite">
        {signed && (
          <button
            type="button"
            className="sig-pill"
            aria-label="Signed. Sign again"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={again}
          >
            <Check size={14} strokeWidth={2} className="sig-check" />
            Signed
          </button>
        )}
      </span>
    </div>
    </div>
  );
}
