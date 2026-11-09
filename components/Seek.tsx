"use client";
/* eslint-disable react-hooks/set-state-in-effect -- kept as the author wrote it */
import { useEffect, useRef, useState } from "react";
import { useSettings } from "../lib/settings";
import "./Seek.css";

/* ══ Seek ═════════════════════════════════════════════════
   A search icon that becomes a search field.

   ONE OBJECT, NOT TWO. A single box whose WIDTH is the state, with the icon and
   the field both inside it the whole time: two things swapping is never mistaken
   for one thing changing, however well the crossfade is tuned.

   · The lens never moves relative to the box. It sits at a fixed inset from the
     left edge, and at the closed width that inset centres it: (48 - 20) / 2 = 14,
     which is also the padding the open field wants.
   · The box grows from its middle, so the composition stays centred at every frame.
   · Height never changes and the corner is fully round at every width: a circle
     at 48, a pill when open. A stadium corner needs no agreement with anything.

   The press is a real beat: a click compresses the object for a moment before it
   expands, because a thing that yields before it moves reads as having been pushed. */

/* ── one spring, for everything that settles ───────────────
   Frames, not milliseconds: `dt` is in sixtieths of a second and the damping is
   RAISED to it rather than multiplied by it, so a dropped frame decays the same
   energy as the two frames it replaced. The loop parks itself once settled.

   The pair is chosen by DAMPING RATIO and written back as stiffness and decay:
     zeta = -ln(d) / (2 * sqrt(k))
     0   -> zeta ~0.85, heavy, arrives without a ring
     50  -> zeta ~0.41
     100 -> zeta ~0.20, lively, two visible rebounds */
const springOf = (tune: number) => ({
  k: 0.08 + (tune / 100) * 0.16, /* how hard it is pulled toward the target */
  d: 0.62 + (tune / 100) * 0.2, /* how much of the velocity survives, per frame */
});

/* Units matter: the snap threshold is absolute, so work in pixels or 0..100 */
function useSpring(target: number, tune = 50, instant = false) {
  const [at, setAt] = useState(target);
  const cur = useRef(target);
  const vel = useRef(0);
  const raf = useRef(0);

  useEffect(() => {
    if (instant) {
      cur.current = target;
      vel.current = 0;
      setAt(target);
      return;
    }
    const { k, d } = springOf(tune);
    let prev = 0;
    const tick = (t: number) => {
      const dt = prev ? clamp((t - prev) / 16.67, 0, 2.5) : 1;
      prev = t;
      vel.current += (target - cur.current) * k * dt;
      vel.current *= Math.pow(d, dt);
      cur.current += vel.current * dt;
      if (Math.abs(target - cur.current) < 0.02 && Math.abs(vel.current) < 0.02) {
        cur.current = target;
        vel.current = 0;
        setAt(target);
        raf.current = 0;
        return;
      }
      setAt(cur.current);
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf.current);
      raf.current = 0;
    };
    /* `tune` sits beside `target` because the loop closes over it: without it a knob turned
       mid-flight would do nothing until something else restarted the effect. Restarting
       picks up from the refs, so it continues rather than snapping. */
  }, [target, tune, instant]);

  return at;
}

/* Read once: a preference, not a live input. */
const stillness = () =>
  typeof window !== "undefined" &&
  !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/* The closed object: a circle, so the width IS the height. 48 sits with the other
   pills on the bench (36-48). The stylesheet reads it through --shut: the skin's
   height and the closed width are the same number by definition. */
const SHUT = 48;
/* the lens and its inset. The svg is an 18-unit viewBox, so a stroke-width of u
   always draws at u/18 of the glyph whatever its size: resizing the icon does not
   disturb the stroke. */
const LENS = 20;
const INSET = (SHUT - LENS) / 2;
/* the field's corner: half its 48px height, the circle it is shut and the pill it is open */
const CORNER = 24;
/* the resting field, wide screen and narrow, plus 26px of frame */
const WIDE = 240;
const SNUG = 220;

type Props = {
  give?: number; /* how far it leans toward the cursor, 0..100 */
  spring?: number; /* how the width settles, 0..100 */
  width?: number; /* the field's resting width, px; unset falls back to WIDE, or SNUG on a narrow screen */
  corner?: number; /* the field's own corner, 0..24 */
};

export function Seek(props: Props) {
  const g = useSettings().seek;
  const give = props.give ?? (g.give as number);
  const spring = props.spring ?? (g.spring as number);
  const width = props.width ?? (g.width as number);
  const corner = props.corner ?? (g.corner as number);

  /* narrow, and it can change under you: a phone rotates, a window gets dragged */
  const [snug, setSnug] = useState(
    () => typeof window !== "undefined"
      && window.matchMedia("(max-width: 760px)").matches,
  );
  /* whether the screen has a keyboard of its own: a different question from `snug`.
     A narrow desktop window is snug and types fine; a tablet is roomy and still
     throws half its screen away to a keyboard. */
  const [touch, setTouch] = useState(
    () => typeof window !== "undefined"
      && window.matchMedia("(pointer: coarse)").matches,
  );
  useEffect(() => {
    const room = window.matchMedia("(max-width: 760px)");
    const coarse = window.matchMedia("(pointer: coarse)");
    const read = () => { setSnug(room.matches); setTouch(coarse.matches); };
    room.addEventListener("change", read);
    coarse.addEventListener("change", read);
    return () => {
      room.removeEventListener("change", read);
      coarse.removeEventListener("change", read);
    };
  }, []);
  const span = width ?? (snug ? SNUG : WIDE);

  const frame = useRef<HTMLDivElement | null>(null);
  const field = useRef<HTMLInputElement | null>(null);
  const beat = useRef(0);
  const rest = useRef(0);

  const [open, setOpen] = useState(false);
  const [press, setPress] = useState(false);
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [lean, setLean] = useState({ x: 0, y: 0 });
  const still = stillness();

  useEffect(() => () => {
    window.clearTimeout(beat.current);
    window.clearTimeout(rest.current);
  }, []);

  /* the width is the state. Tuned toward the top of the range: a control that wobbles
     reads as decoration; the spring is for the tiny overshoot that makes it arrive. */
  const target = open ? Math.max(SHUT, span) : SHUT;
  const w = useSpring(target, clamp(spring, 0, 100), still);

  /* how far through the transformation, 0 shut and 1 open */
  const p = clamp((w - SHUT) / Math.max(1, Math.max(SHUT, span) - SHUT), 0, 1);

  /* ── the magnet ──────────────────────────────────────────
     Measured from the FRAME, which never moves, and not from the object, which does:
     a vector read off a thing it is displacing is a feedback loop that converges by
     ringing, visible as a shiver on an object this small. Off once open: a field that
     drifts toward the pointer while you click into it is a field fighting you. */
  useEffect(() => {
    const el = frame.current;
    if (!el || open || still) return;
    let raf = 0;
    let at = { x: 0, y: 0 };
    const publish = () => { raf = 0; setLean(at); };
    const read = (e: PointerEvent) => {
      const b = el.getBoundingClientRect();
      /* the wall draws this at a fraction and the canvas at a zoom */
      const k = b.width / (el.offsetWidth || b.width) || 1;
      const dx = (e.clientX - (b.left + b.width / 2)) / k;
      const dy = (e.clientY - (b.top + b.height / 2)) / k;
      const d = Math.hypot(dx, dy);
      const R = 110;
      if (d > R) {
        if (at.x || at.y) { at = { x: 0, y: 0 }; if (!raf) raf = requestAnimationFrame(publish); }
        return;
      }
      /* A FEW PIXELS: past about seven it stops acknowledging you and starts being dragged around */
      const pull = (1 - d / R) ** 1.4 * (2 + (give / 100) * 5);
      at = { x: (dx / (d || 1)) * pull, y: (dy / (d || 1)) * pull };
      if (!raf) raf = requestAnimationFrame(publish);
    };
    const gone = () => { at = { x: 0, y: 0 }; if (!raf) raf = requestAnimationFrame(publish); };
    document.addEventListener("pointermove", read, { passive: true });
    document.addEventListener("pointerleave", gone);
    return () => {
      document.removeEventListener("pointermove", read);
      document.removeEventListener("pointerleave", gone);
      cancelAnimationFrame(raf);
    };
  }, [open, give, still]);

  /* ── opening: compress, then expand, then focus ──────────
     90ms is long enough to be felt as the object yielding and short enough that nobody
     waits for it. Focus lands with the expansion, so the caret is already there when
     the field arrives. */
  const start = () => {
    if (open) return;
    setPress(true);
    window.clearTimeout(beat.current);
    beat.current = window.setTimeout(() => {
      setPress(false);
      setOpen(true);
      field.current?.focus();
    }, still ? 0 : 90);
  };

  /* Away with nothing typed and it goes back. Away with something typed and it stays:
     the value IS the reason the field exists. */
  const away = () => {
    if (value.trim()) return;
    setOpen(false);
  };

  /* the lens acknowledges typing without performing it: one short beat per burst, not per key */
  const tapped = () => {
    setBusy(true);
    window.clearTimeout(rest.current);
    rest.current = window.setTimeout(() => setBusy(false), 340);
  };

  return (
    <div
      className="sek"
      ref={frame}
      data-open={open}
      data-press={press}
      data-busy={busy}
      data-flat={still || undefined}
      style={{
        "--sek-r": `${clamp(corner, 0, CORNER)}px`,
        "--w": `${w.toFixed(2)}px`,
        "--p": p.toFixed(3),
        /* the placeholder and the caret arrive in the last third, once there is somewhere for them to be */
        "--say": clamp((p - 0.55) / 0.45, 0, 1).toFixed(3),
        "--lx": `${lean.x.toFixed(2)}px`,
        "--ly": `${lean.y.toFixed(2)}px`,
        "--inset": `${INSET}px`,
        "--lens": `${LENS}px`,
        "--shut": `${SHUT}px`,
        /* the frame follows the field, tight to what is set; it changes with a knob, never
           with the open/shut state, which is what the magnet needs */
        "--frame": `${Math.max(SHUT, span) + 26}px`,
        "--frameh": `${SHUT + 40}px`,
      } as React.CSSProperties}
    >
      <div className="sek-skin">
        {/* Drawn rather than imported: the lens has to take a state (it thickens while you type) */}
        <svg className="sek-lens" viewBox="0 0 18 18" aria-hidden="true">
          <circle cx="7.6" cy="7.6" r="5.4" />
          <path d="M11.6 11.6 L15.4 15.4" />
        </svg>

        <input
          ref={field}
          className="sek-field"
          type="text"
          value={value}
          placeholder="Search"
          aria-label="Search"
          /* no software keyboard on a touch screen: `inputMode` and not `readOnly` (a tablet with a
             real keyboard still types), and still focused (`away` is a blur handler, so a field that
             never takes focus never gives it back). none = focusable, has a caret, no on-screen keyboard. */
          inputMode={touch ? "none" : undefined}
          tabIndex={open ? 0 : -1}
          onChange={(e) => { setValue(e.target.value); tapped(); }}
          onBlur={away}
          onKeyDown={(e) => {
            if (e.key !== "Escape") return;
            e.preventDefault();
            setValue("");
            setOpen(false);
            field.current?.blur();
          }}
        />

        {/* The way in, and only while there is a way in: open, a second target over the field
            would swallow the click that places the caret. */}
        {!open && (
          <button className="sek-hit" aria-label="Search" onClick={start} />
        )}
      </div>
    </div>
  );
}
