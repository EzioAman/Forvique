"use client";
/* eslint-disable react-hooks/refs -- kept as the author wrote it: the count curve is a ref re-rolled per run */
import { useEffect, useId, useRef, useState } from "react";
import { useSettings } from "../lib/settings";
import "./Generate.css";

/* Read once, the way the wheel and the pill nav do. A preference, not a live input. */
const stillness = () =>
  typeof window !== "undefined" &&
  !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/* ══ Generate ═════════════════════════════════════════════
   A picture that is made in front of you, slowly. Press Generate and the
   print arrives the way a generated image does — the large decisions first
   and the fine ones last — under a glassy liquid surface that stills as it lands.

   THREE SCALES OF DETAIL, IN ORDER
   · SHAPES. Heavily blurred and pushed hard in contrast: a few clean glassy masses.
   · FORM. The blur lets go on a slow curve and the contrast eases back to the
     print's own; a low drifting ripple keeps the surface liquid.
   · GRAIN. The sharp print only comes in over the last quarter.

   IDENTITY AT REST. The filter only exists while a run is going. At rest the
   card is the print and nothing else. */

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const smooth = (a: number, b: number, v: number) => {
  const u = clamp((v - a) / (b - a), 0, 1);
  return u * u * (3 - 2 * u);
};

/* the print's paper, as a luminance. Contrast turns about THIS rather than mid-grey:
   about 0.5 the paper went to white and the card snapped back to grey at the end. */
const PAPER = 0.9;

/* ── the count keeps its own time ─────────────────────────
   A number climbing at one steady rate reads as a timer, not as work. So the
   count runs on a curve of its own, re-rolled every run: quick start, slow
   stretch, burst, stall, burst, crawl. The picture forms on the plain clock
   underneath; only the number is uneven. Knots are (time, value) pairs, both
   rising, so the count never goes backwards. */
type Knot = [number, number];
const r = (a: number, b: number) => a + Math.random() * (b - a);
const knots = (): Knot[] => [
  [0, 0],
  [r(0.1, 0.16), r(0.1, 0.16)],   /* quick start */
  [r(0.32, 0.38), r(0.22, 0.3)],  /* slow stretch */
  [r(0.44, 0.49), r(0.5, 0.6)],   /* burst */
  [r(0.56, 0.61), r(0.62, 0.68)], /* stall */
  [r(0.68, 0.72), r(0.84, 0.88)], /* burst */
  [1, 1],                         /* and the long last bit */
];
/* a fixed curve for the first render; every run rolls its own */
const REST: Knot[] = [[0, 0], [0.13, 0.13], [0.35, 0.26], [0.46, 0.55], [0.58, 0.65], [0.7, 0.86], [1, 1]];
const along = (ks: Knot[], t: number) => {
  for (let i = 1; i < ks.length; i++) {
    const [t0, v0] = ks[i - 1];
    const [t1, v1] = ks[i];
    if (t > t1) continue;
    const u = clamp((t - t0) / (t1 - t0), 0, 1);
    return mix(v0, v1, mix(u, u * u * (3 - 2 * u), 0.5));
  }
  return 1;
};

type Props = {
  src?: string; /* the print. The author's picture is not licensed to travel: point this at yours */
  pace?: number; /* seconds from the press to the picture */
  ripple?: number; /* how liquid the surface is while it forms, 0..100 */
  corner?: number; /* the frame's corner, px; the button is always a pill */
};

export function Generate(props: Props) {
  const g = useSettings().generate;
  const FLOWER = props.src ?? "";
  const pace = props.pace ?? (g.pace as number);
  const ripple = props.ripple ?? (g.ripple as number);
  const corner = props.corner ?? (g.corner as number);

  const still = stillness();
  const id = `gen-${useId().replace(/:/g, "")}`;
  const [t, setT] = useState(1);
  const raf = useRef(0);
  const curve = useRef<Knot[]>(REST); /* re-rolled on each press, never at render: Math.random() in a client render breaks prerender */
  const busy = t < 1;
  /* 100 is held for a beat, so the count is seen to arrive instead of stopping at 99 */
  const [held, setHeld] = useState(false);
  /* it starts EMPTY: a block about making a picture that already has the picture in it
     has answered its own question. Pressing again remakes it from blank. */
  const [made, setMade] = useState(false);
  const hold = useRef(0);
  const loading = busy || held;
  /* 99 at most until the run has actually finished: the 100 belongs to the picture landing */
  const pct = held ? 100 : Math.min(99, Math.floor(along(curve.current, t) * 100));

  useEffect(() => () => {
    cancelAnimationFrame(raf.current);
    raf.current = 0;
    window.clearTimeout(hold.current);
  }, []);

  const generate = () => {
    if (loading) return;
    const total = still ? 400 : Math.max(2, pace) * 1000;
    let t0 = 0;
    const tick = (now: number) => {
      if (!t0) t0 = now;
      const v = Math.min(1, (now - t0) / total);
      setT(v);
      if (v < 1) raf.current = requestAnimationFrame(tick);
      else {
        raf.current = 0;
        setMade(true);
        setHeld(true);
        hold.current = window.setTimeout(() => setHeld(false), 650);
      }
    };
    curve.current = knots();
    setT(0);
    raf.current = requestAnimationFrame(tick);
  };

  /* ── the three windows ── */
  /* one long rise, no pulse: a picture that dims and brightens before it has started reads as hesitating */
  const haze = smooth(0, 0.3, t);
  const form = smooth(0.1, 0.82, t);
  const grain = smooth(0.7, 1, t);
  /* blur falls fast at first and then crawls through the small radii, where the detail lives */
  const sd = mix(20, 1.6, 1 - Math.pow(1 - form, 2.2));
  const k = mix(2.4, 1, form);
  const warp = (clamp(ripple, 0, 100) / 100) * 32 * Math.pow(1 - smooth(0.05, 0.9, t), 1.5);
  /* a slow drift in the noise so the water moves rather than sitting as a fixed distortion */
  const f = 0.006 + 0.0018 * Math.sin(t * 4.4);
  const cut = (PAPER - PAPER * k).toFixed(3);

  return (
    <div className="gen" data-busy={busy} data-loading={loading} data-made={made}>
      <div className="gen-card" style={{ borderRadius: clamp(corner, 0, 40) }}>
        {busy && !still && (
          <>
            <svg className="gen-defs" aria-hidden="true">
              <filter id={id} x="-10%" y="-10%" width="120%" height="120%" colorInterpolationFilters="sRGB">
                <feTurbulence type="fractalNoise" baseFrequency={`${f.toFixed(4)} ${(f * 1.3).toFixed(4)}`} numOctaves={2} seed={7} result="n" />
                <feDisplacementMap in="SourceGraphic" in2="n" scale={warp.toFixed(2)} xChannelSelector="R" yChannelSelector="G" result="d" />
                <feGaussianBlur in="d" stdDeviation={sd.toFixed(2)} />
                <feComponentTransfer>
                  <feFuncR type="linear" slope={k.toFixed(3)} intercept={cut} />
                  <feFuncG type="linear" slope={k.toFixed(3)} intercept={cut} />
                  <feFuncB type="linear" slope={k.toFixed(3)} intercept={cut} />
                </feComponentTransfer>
              </filter>
            </svg>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              className="gen-print"
              src={FLOWER}
              alt=""
              draggable={false}
              style={{
                filter: `url(#${id})`,
                opacity: haze * mix(0.7, 1, form),
                scale: `${mix(1.04, 1, smooth(0, 0.9, t))}`,
              }}
            />
          </>
        )}
        {/* the print: the whole card at rest once made, and the sharp image that arrives last during a run */}
        {(made || busy) && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            className="gen-print"
            src={FLOWER}
            alt="The generated print"
            draggable={false}
            style={busy ? {
              opacity: still ? t : grain,
              filter: still ? undefined : `blur(${mix(1.6, 0, grain).toFixed(2)}px)`,
            } : undefined}
          />
        )}

        {/* the way in, in the middle: the only thing on the blank frame; once made it steps aside until hover */}
        <button
          className="gen-go"
          onClick={generate}
          disabled={loading}
          tabIndex={loading ? -1 : 0}
          aria-label="Generate"
        >
          <span>Generate</span>
        </button>

        {/* and the count, small, in the corner; held at 100 for a beat */}
        <span className="gen-pct" role="status" aria-live="off">
          {pct}%
        </span>
      </div>
    </div>
  );
}
