"use client";
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { useSettings } from "../../../lib/settings";
import "./Watcher.css";

/* Eye tracker: each eye is a point on a sphere, the pointer turns the
   sphere, and the eye nearing the rim moves less and narrows (foreshortening).
   Written straight to the DOM every frame, never through state.
   Any prop overrides the global value from /settings. */

const stillness = () =>
  typeof window !== "undefined" &&
  !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

const R = 50; /* ball radius in the 100-unit viewBox */

type Eye = { w: number; h: number; r: number };
const STYLES: Record<string, Eye> = {
  Slant: { w: 9, h: 15, r: 4.5 },
  Dots: { w: 11, h: 11, r: 5.5 },
  Squares: { w: 12, h: 12, r: 3.5 },
};
const GAP = 0.19; /* half the gap between the eyes, as a fraction of the radius */
const TILT = 64; /* degrees a corner look tilts the pair */

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

/* Emotions are read through the eyes: a top lid and a bottom cheek in the body
   colour cut into each eye (invisible on the flat body), a scale, a gaze offset
   and a blush below each eye. Eased toward the target every frame. */
type Emo = { lid: number; ang: number; cheek: number; scale: number; blush: number; dy: number; gx: number; gy: number };
const N: Emo = { lid: 0, ang: 0, cheek: 0, scale: 1, blush: 0, dy: 0, gx: 0, gy: 0 };
const EMOS: Record<string, Emo> = {
  Neutral: N,
  Happy: { ...N, cheek: 1, scale: 1.08, dy: -1 },
  Angry: { ...N, lid: 0.42, ang: 24 }, /* lid slants down toward the nose */
  Sad: { ...N, lid: 0.38, ang: -20, scale: 0.95, dy: 2.5 },
  Surprised: { ...N, scale: 1.4, dy: -1.5 },
  Sleepy: { ...N, lid: 0.58, cheek: 0.12, dy: 2 },
  Love: { ...N, lid: 0.25, ang: -6, scale: 0.88, dy: 2.5, blush: 1, gx: -0.22, gy: 0.2 }, /* shown as shy */
};
const POKES = ["Happy", "Angry", "Sad", "Surprised", "Sleepy", "Love"];
const SAY: Record<string, string[]> = {
  Happy: ["Hehe, that tickles!", "You made my day.", "Yay, a friend!"],
  Angry: ["Hey! Hands off.", "Rude. Very rude.", "I'm counting to three."],
  Sad: ["Oh... okay.", "That wasn't very nice.", "I just wanted a hug."],
  Surprised: ["Whoa! You scared me.", "Wait, what?!", "Oh! Hi there!"],
  Sleepy: ["Five more minutes...", "Zzz... huh?", "So sleepy today."],
  Love: ["U-um, hi...", "Don't stare...", "You're making me blush."],
};
const HUMS = ["La la la~", "Hm hm hmm~", "Doo be doo~"];
const IDLE_ACTS = ["Hop", "Doze", "Yawn", "Tilt"]; /* body motions owned by the idle loop */
const QUIET_IDLE = 2500; /* no pointer or click for this long starts the idle loop */
const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const TINTS = ["#3b5bff", "#179c52", "#e0307f"];
const KEY_MS = 38;
const HOLD_MS = 1500;
const ACT_MS = 1600; /* matches the motion length in Watcher.css */
const QUIET_MS = 2400; /* how long a reaction lasts with speech off */

export const SHAPES: Record<string, string> = {
  Ball: "M50 0 A50 50 0 1 1 49.99 0 Z",
  Circle: "M50 7 A43 43 0 1 1 49.99 7 Z",
  Cube: "M30 6 H70 A24 24 0 0 1 94 30 V70 A24 24 0 0 1 70 94 H30 A24 24 0 0 1 6 70 V30 A24 24 0 0 1 30 6 Z",
  Pill: "M34 17 H66 A33 33 0 0 1 66 83 H34 A33 33 0 0 1 34 17 Z",
  Hexagon: "M59.53 8.50 L81.18 21.00 Q90.70 26.50 90.70 37.50 L90.70 62.50 Q90.70 73.50 81.18 79.00 L59.53 91.50 Q50.00 97.00 40.47 91.50 L18.82 79.00 Q9.30 73.50 9.30 62.50 L9.30 37.50 Q9.30 26.50 18.82 21.00 L40.47 8.50 Q50.00 3.00 59.53 8.50 Z",
  "Hex flat": "M91.50 59.53 L79.00 81.18 Q73.50 90.70 62.50 90.70 L37.50 90.70 Q26.50 90.70 21.00 81.18 L8.50 59.53 Q3.00 50.00 8.50 40.47 L21.00 18.82 Q26.50 9.30 37.50 9.30 L62.50 9.30 Q73.50 9.30 79.00 18.82 L91.50 40.47 Q97.00 50.00 91.50 59.53 Z",
};

/* Morph: each shape is read as its distance from the centre at RAYS angles
   (all are star-shaped), eased between, and drawn back out as a path. */
const RAYS = 120;
const radii = new Map<string, number[]>();

function measure(shape: string): number[] {
  const hit = radii.get(shape);
  if (hit) return hit;
  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("viewBox", "0 0 100 100");
  svg.style.cssText = "position:absolute;width:0;height:0;overflow:hidden";
  const path = document.createElementNS(ns, "path");
  path.setAttribute("d", SHAPES[shape] ?? SHAPES.Ball);
  svg.appendChild(path);
  document.body.appendChild(svg);
  const pt = svg.createSVGPoint();
  const out: number[] = [];
  for (let i = 0; i < RAYS; i++) {
    const a = (i / RAYS) * Math.PI * 2 - Math.PI / 2;
    let lo = 0, hi = 60;
    for (let k = 0; k < 16; k++) {
      const mid = (lo + hi) / 2;
      pt.x = 50 + Math.cos(a) * mid;
      pt.y = 50 + Math.sin(a) * mid;
      if (path.isPointInFill(pt)) lo = mid; else hi = mid;
    }
    out.push(lo);
  }
  svg.remove();
  radii.set(shape, out);
  return out;
}

function outline(r: number[]): string {
  let d = "";
  r.forEach((v, i) => {
    const a = (i / r.length) * Math.PI * 2 - Math.PI / 2;
    d += `${i ? "L" : "M"}${(50 + Math.cos(a) * v).toFixed(2)} ${(50 + Math.sin(a) * v).toFixed(2)}`;
  });
  return d + "Z";
}

type Props = {
  follow?: number; /* how far it turns toward the pointer, 0..100 */
  bounce?: number; /* overshoot and settle, 0..100 */
  size?: number;
  shape?: string;
  eyes?: string;
  eyeScale?: number;
  eyeWidth?: number;
  eyeRound?: number; /* 1 fully round; below 1 squares off */
  eyeHeight?: number;
  idle?: boolean; /* a mark: ignores the pointer, glances every 5s, blinks every 2s */
  fill?: string; /* Light or Dark body */
  within?: string; /* selector of the box it watches inside */
  mood?: string; /* resting emotion */
  poke?: string; /* reaction on click: an emotion, or Random */
  speech?: string; /* On or Off */
  idleStyle?: string; /* Off, Random, Playful, Cheerful, Sleepy, Curious: what it does when left alone */
};

export function Watcher(props: Props) {
  const g = useSettings().watcher;
  const { idle = false, within } = props;
  const follow = props.follow ?? (g.follow as number);
  const bounce = props.bounce ?? (g.bounce as number);
  const size = props.size ?? (g.size as number);
  const shape = props.shape ?? (g.shape as string);
  const look = props.eyes ?? (g.eyes as string);
  const eyeScale = props.eyeScale ?? (g.eyeScale as number);
  const eyeWidth = props.eyeWidth ?? (g.eyeWidth as number);
  const eyeRound = props.eyeRound ?? (g.eyeRound as number);
  const eyeHeight = props.eyeHeight ?? (g.eyeHeight as number);
  const fill = props.fill ?? (g.fill as string);
  const mood = props.mood ?? (g.mood as string);
  const reaction = props.poke ?? (g.poke as string);
  const speech = (props.speech ?? (g.speech as string)) !== "Off";
  const idleStyle = props.idleStyle ?? (g.idleStyle as string);

  const still = stillness();
  const box = useRef<HTMLDivElement>(null);
  const ball = useRef<SVGSVGElement>(null);
  const [typed, setTyped] = useState("");
  const [talking, setTalking] = useState(false);
  const [tint, setTint] = useState(TINTS[0]);
  const turn = useRef(0);
  const lastLine = useRef("");
  const lastPoke = useRef("");
  /* the emotion the frame loop eases toward */
  const want = useRef(mood);
  const moodNow = useRef(mood);
  useLayoutEffect(() => { moodNow.current = mood; want.current = mood; }, [mood]);
  useEffect(() => () => { turn.current++; }, []);
  const busy = useRef(false); /* a click reaction is playing; the idle loop waits */
  const poke = async () => {
    if (idle) return;
    const mine = ++turn.current;
    busy.current = true;
    const emo = POKES.includes(reaction)
      ? reaction
      : (() => { const p = POKES.filter((e) => e !== lastPoke.current); return p[Math.floor(Math.random() * p.length)]; })();
    lastPoke.current = emo;
    want.current = emo;
    const b = ball.current;
    if (b) {
      b.removeAttribute("data-act");
      void b.getBoundingClientRect(); /* restarts the motion when the same one repeats */
      b.setAttribute("data-act", emo);
      window.setTimeout(() => { if (mine === turn.current) b.removeAttribute("data-act"); }, ACT_MS);
    }
    const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
    if (speech) {
      const pool = SAY[emo].filter((l) => l !== lastLine.current);
      const line = pool[Math.floor(Math.random() * pool.length)];
      lastLine.current = line;
      setTint(TINTS[Math.floor(Math.random() * TINTS.length)]);
      setTyped("");
      setTalking(true);
      for (let k = 1; k <= line.length; k++) {
        await wait(KEY_MS + Math.random() * 30);
        if (mine !== turn.current) return;
        setTyped(line.slice(0, k));
      }
      await wait(HOLD_MS);
      if (mine !== turn.current) return;
      setTalking(false);
    } else {
      await wait(QUIET_MS);
      if (mine !== turn.current) return;
    }
    want.current = moodNow.current;
    busy.current = false;
  };
  const eyes = useRef<(SVGGElement | null)[]>([]);
  const knobs = useRef({ follow, bounce, eyeScale, speech });
  const base = STYLES[look] ?? STYLES.Slant;
  const eye = {
    w: base.w * eyeScale * eyeWidth,
    h: base.h * eyeScale * eyeHeight,
    r: base.r * eyeScale * eyeWidth * eyeRound,
  };
  const eyeNow = useRef(eye);
  /* hand the latest values to the frame loop after every render */
  useLayoutEffect(() => {
    knobs.current = { follow, bounce, eyeScale, speech };
    eyeNow.current = eye;
  });

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const t = { x: 0, y: 0, vx: 0, vy: 0, tx: 0, ty: 0 };
    let raf = 0;
    let prev = 0;
    let blink = 0;
    let nextBlink = performance.now() + 2200;
    const m: Emo = { ...(EMOS[want.current] ?? N) };
    const keys = Object.keys(m) as (keyof Emo)[];
    /* written by the idle loop below */
    let idleOn = false;
    let idleEmo: string | null = null; /* null: rest on the mood */
    let lidBias = 0; /* extra lid droop (+) or wide-open snap (-) */
    let hopEyes = 0, hopNow = 0; /* little eye bounce, eased */
    const wink = { at: -1e9, eye: 0 };

    const draw = (now: number) => {
      let lid = 1;
      if (now > nextBlink) {
        blink = now;
        nextBlink = now + (idle ? 2000 : 2600 + Math.random() * 3200);
      }
      const since = now - blink;
      if (since < 160) lid = 1 - 0.9 * Math.sin((since / 160) * Math.PI);
      const ws = now - wink.at;
      const winkLid = ws < 340 ? 1 - 0.92 * Math.sin((ws / 340) * Math.PI) : 1;
      const lift = -Math.abs(Math.sin(now / 170)) * 1.8 * hopNow;

      const as = (v: number) => Math.asin(clamp(v, -0.92, 0.92));
      const yaw = as(t.x + m.gx);
      const pitch = -as(t.y + m.gy);
      const cy = Math.cos(yaw), sy = Math.sin(yaw);
      const cp = Math.cos(pitch), sp = Math.sin(pitch);
      const tilt = TILT * t.x * t.y;
      const g0 = GAP * Math.max(1, knobs.current.eyeScale * 0.8);

      [-g0, g0].forEach((x0, i) => {
        const gEl = eyes.current[i];
        if (!gEl) return;
        const z0 = Math.sqrt(1 - x0 * x0);
        const x1 = x0 * cy + z0 * sy;
        const z1 = -x0 * sy + z0 * cy;
        const y2 = -z1 * sp;
        const z2 = z1 * cp;
        const near = clamp(z2, 0, 1);
        const k = 0.45 + 0.55 * near;
        const sx = k * (0.7 + 0.3 * near);
        /* size written as width/height, never a scale, so every corner keeps the same radius */
        const e0 = eyeNow.current;
        const w = e0.w * sx * m.scale;
        const h0 = e0.h * k * m.scale;
        const h = Math.max(0.6, h0 * lid * (i === wink.eye ? winkLid : 1));
        const [rect, lidEl, cheek, blush] = gEl.children as unknown as SVGElement[];
        if (rect) {
          rect.setAttribute("x", (-w / 2).toFixed(2));
          rect.setAttribute("y", (-h / 2).toFixed(2));
          rect.setAttribute("width", w.toFixed(2));
          rect.setAttribute("height", h.toFixed(2));
          rect.setAttribute("rx", Math.min(e0.r, w / 2, h / 2).toFixed(2));
        }
        if (lidEl) {
          /* bottom edge sits just above the eye at rest; mirrored per eye so slants meet at the nose */
          const edge = -h / 2 - 0.5 + m.lid * (h + 0.5);
          lidEl.setAttribute("x", (-w * 0.75).toFixed(2));
          lidEl.setAttribute("y", (edge - h * 2 - 2).toFixed(2));
          lidEl.setAttribute("width", (w * 1.5).toFixed(2));
          lidEl.setAttribute("height", (h * 2 + 2).toFixed(2));
          lidEl.setAttribute("transform", `rotate(${((i ? -1 : 1) * m.ang).toFixed(2)} 0 ${edge.toFixed(2)})`);
        }
        if (cheek) {
          /* rises from below to carve the eye into a ^ */
          const r = w * 0.85;
          const top = h / 2 + 0.5 - m.cheek * (h * 0.62 + 0.5);
          cheek.setAttribute("cy", (top + r).toFixed(2));
          cheek.setAttribute("r", r.toFixed(2));
        }
        if (blush) {
          /* below and a little outside each eye; sized from the open eye so a blink leaves it be */
          const rx = Math.max(e0.w, 7) * 0.7 * sx;
          blush.setAttribute("cx", ((i ? 1 : -1) * w * 0.45).toFixed(2));
          blush.setAttribute("cy", (h0 / 2 + 3.2).toFixed(2));
          blush.setAttribute("rx", rx.toFixed(2));
          blush.setAttribute("ry", (rx * 0.55).toFixed(2));
          blush.style.opacity = (0.55 * clamp(m.blush, 0, 1)).toFixed(3);
        }
        gEl.setAttribute(
          "transform",
          `translate(${(50 + x1 * R).toFixed(2)} ${(50 + y2 * R + m.dy + lift).toFixed(2)}) rotate(${tilt.toFixed(2)})`,
        );
        gEl.style.opacity = z2 < 0.05 ? "0" : "1";
      });
    };

    /* only runs while visible */
    let seen = true;
    const tick = (now: number) => {
      if (!seen || document.hidden) { raf = 0; prev = 0; return; }
      const dt = prev ? Math.min(2.5, (now - prev) / 16.67) : 1;
      prev = now;
      if (still) {
        t.x = t.tx;
        t.y = t.ty;
      } else {
        const k = 0.06;
        const d = 0.34 - (clamp(knobs.current.bounce, 0, 100) / 100) * 0.22;
        t.vx += ((t.tx - t.x) * k - t.vx * d) * dt;
        t.vy += ((t.ty - t.y) * k - t.vy * d) * dt;
        t.x += t.vx * dt;
        t.y += t.vy * dt;
      }
      const tgt = EMOS[(idleOn && idleEmo) || want.current] ?? N;
      const a = still ? 1 : 1 - Math.pow(0.85, dt);
      for (const key of keys) m[key] += (tgt[key] + (key === "lid" ? lidBias : 0) - m[key]) * a;
      hopNow += (hopEyes - hopNow) * a;
      draw(now);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    const resume = () => { if (!raf && seen && !document.hidden) raf = requestAnimationFrame(tick); };
    const io = new IntersectionObserver(([e]) => { seen = e.isIntersecting; resume(); });
    io.observe(el);
    document.addEventListener("visibilitychange", resume);
    const unwatch = () => { io.disconnect(); document.removeEventListener("visibilitychange", resume); };

    /* watches the pointer only while it is inside its card/board; faces front when it leaves */
    const frame = el.closest<HTMLElement>(within ?? ".bench-card, .dtl-block, .board, .sf-thumb") ?? el;
    const aim = (e: PointerEvent) => {
      const f = frame.getBoundingClientRect();
      if (e.clientX < f.left || e.clientX > f.right || e.clientY < f.top || e.clientY > f.bottom) {
        if (idleOn) return; /* the idle loop owns the gaze */
        t.tx = 0;
        t.ty = 0;
        return;
      }
      wake();
      const r = el.getBoundingClientRect();
      const dx = e.clientX - (r.left + r.width / 2);
      const dy = e.clientY - (r.top + r.height / 2);
      const d = Math.hypot(dx, dy) || 1;
      const reach = Math.max(60, Math.min(f.width, f.height) * 0.28);
      const far = Math.min(0.85, Math.tanh(d / reach) * (clamp(knobs.current.follow, 0, 100) / 100) * 1.5);
      t.tx = (dx / d) * far;
      t.ty = (dy / d) * far;
    };
    const rest = () => { t.tx = 0; t.ty = 0; };

    if (idle) {
      let glance = 0;
      const peek = () => {
        const a = Math.random() * Math.PI * 2;
        const far = 0.45 + Math.random() * 0.25;
        t.tx = Math.cos(a) * far;
        t.ty = Math.sin(a) * far;
        glance = window.setTimeout(() => {
          rest();
          glance = window.setTimeout(peek, 5000 - 900);
        }, 900);
      };
      glance = window.setTimeout(peek, 5000);
      return () => {
        cancelAnimationFrame(raf);
        unwatch();
        window.clearTimeout(glance);
      };
    }

    /* Idle loop: after a quiet spell it plays a randomised routine of its own.
       Any pointer move inside the frame or a click stops it and eases back to the mood. */
    let style = still ? "Off" : idleStyle; /* reduced motion: the static mood only */
    /* "Random" swaps to a different routine every 9-15s of idling */
    const ROUTINES = ["Playful", "Cheerful", "Sleepy", "Curious"];
    let switchAt = 0;
    let quiet = 0, step = 0, said = 0;
    const acts: number[] = [];
    const later = (fn: () => void, ms: number) => { step = window.setTimeout(fn, ms); };
    const act = (name: string, ms: number) => {
      const b = ball.current;
      if (!b || b.hasAttribute("data-act") && !IDLE_ACTS.includes(b.getAttribute("data-act")!)) return;
      b.removeAttribute("data-act");
      void b.getBoundingClientRect();
      b.setAttribute("data-act", name);
      if (ms) acts.push(window.setTimeout(() => { if (b.getAttribute("data-act") === name) b.removeAttribute("data-act"); }, ms));
    };
    const say = (line: string) => {
      if (!knobs.current.speech) return;
      setTint(TINTS[Math.floor(Math.random() * TINTS.length)]);
      setTyped(line);
      setTalking(true);
      window.clearTimeout(said);
      said = window.setTimeout(() => setTalking(false), 1500);
    };
    const glance = (far: number) => {
      const a = Math.random() * Math.PI * 2;
      t.tx = Math.cos(a) * far;
      t.ty = Math.sin(a) * far * 0.7;
    };
    let heading = Math.random() * Math.PI * 2;
    const enter = () => {
      if (idleStyle === "Random") {
        const pool = ROUTINES.filter((x) => x !== style);
        style = pool[Math.floor(Math.random() * pool.length)];
        switchAt = performance.now() + rnd(9000, 15000);
      }
      idleEmo = null; lidBias = 0; hopEyes = 0;
      acts.forEach((id) => window.clearTimeout(id));
      acts.length = 0;
      ball.current?.removeAttribute("data-act");
      if (style === "Cheerful") idleEmo = "Happy";
      if (style === "Sleepy") { idleEmo = "Sleepy"; act("Doze", 0); }
    };
    const beat = () => {
      if (!idleOn) return;
      if (!seen || document.hidden) return later(beat, 1000); /* nothing plays off-screen */
      if (idleStyle === "Random" && performance.now() > switchAt) enter();
      const r = Math.random();
      if (style === "Playful") {
        if (r < 0.4) { glance(rnd(0.4, 0.75)); acts.push(window.setTimeout(() => { if (idleOn) rest(); }, rnd(400, 900))); }
        else if (r < 0.6) { wink.at = performance.now(); wink.eye = Math.random() < 0.5 ? 0 : 1; }
        else if (r < 0.8) act("Hop", 700);
        else { idleEmo = "Happy"; acts.push(window.setTimeout(() => { idleEmo = null; }, rnd(600, 1000))); }
        return later(beat, rnd(900, 2300));
      }
      if (style === "Cheerful") {
        if (r < 0.35) act("Hop", 700);
        else if (r < 0.65) { hopEyes = 1; acts.push(window.setTimeout(() => { hopEyes = 0; }, rnd(1000, 1800))); }
        else if (r < 0.85) { glance(rnd(0.3, 0.55)); acts.push(window.setTimeout(() => { if (idleOn) rest(); }, rnd(500, 900))); }
        else say(HUMS[Math.floor(Math.random() * HUMS.length)]);
        return later(beat, rnd(1200, 2800));
      }
      if (style === "Sleepy") {
        if (r < 0.55) {
          /* lids droop further, then snap open */
          lidBias = rnd(0.2, 0.32);
          acts.push(window.setTimeout(() => { lidBias = -0.55; }, rnd(1400, 2600)));
          acts.push(window.setTimeout(() => { lidBias = 0; }, rnd(2800, 3200)));
        } else {
          idleEmo = "Surprised";
          act("Yawn", 1100);
          if (Math.random() < 0.6) say("zZz");
          acts.push(window.setTimeout(() => { idleEmo = "Sleepy"; act("Doze", 0); }, 1100));
        }
        return later(beat, rnd(3200, 5200));
      }
      if (style === "Curious") {
        /* a slow wandering path, with the odd tilt or surprised blip */
        heading += rnd(0.6, 1.5) * (Math.random() < 0.5 ? -1 : 1);
        const far = rnd(0.4, 0.7);
        t.tx = Math.cos(heading) * far;
        t.ty = Math.sin(heading) * far * 0.7;
        if (r < 0.25) act("Tilt", 1800);
        else if (r < 0.4) { idleEmo = "Surprised"; acts.push(window.setTimeout(() => { idleEmo = null; }, 450)); }
        return later(beat, rnd(1100, 2200));
      }
    };
    const start = () => {
      if (style !== "Random" && !ROUTINES.includes(style)) return;
      if (busy.current) { quiet = window.setTimeout(start, QUIET_IDLE); return; } /* never over a reaction */
      idleOn = true;
      enter();
      later(beat, rnd(300, 900));
    };
    function wake() {
      window.clearTimeout(quiet);
      quiet = window.setTimeout(start, QUIET_IDLE + rnd(0, 600));
      if (!idleOn) return;
      idleOn = false;
      idleEmo = null;
      lidBias = 0;
      hopEyes = 0;
      window.clearTimeout(step);
      acts.forEach((id) => window.clearTimeout(id));
      acts.length = 0;
      const b = ball.current;
      if (b && IDLE_ACTS.includes(b.getAttribute("data-act") ?? "")) b.removeAttribute("data-act");
      if (said) { window.clearTimeout(said); said = 0; setTalking(false); }
    }
    const down = () => wake();
    quiet = window.setTimeout(start, QUIET_IDLE);

    window.addEventListener("pointermove", aim, { passive: true });
    frame.addEventListener("pointerdown", down);
    document.documentElement.addEventListener("pointerleave", rest);
    return () => {
      cancelAnimationFrame(raf);
      unwatch();
      wake();
      window.clearTimeout(quiet);
      window.removeEventListener("pointermove", aim);
      frame.removeEventListener("pointerdown", down);
      document.documentElement.removeEventListener("pointerleave", rest);
    };
  }, [still, idle, within, idleStyle]);

  const s = clamp(size, 16, 180);
  /* frozen at mount: later shapes are drawn by the morph effect, never by React */
  const [first] = useState(() => SHAPES[shape] ?? SHAPES.Ball);
  const clip = `eyt-clip-${useId().replace(/:/g, "")}`;

  /* a change of shape morphs across ~half a second with a little overshoot */
  const bodyEl = useRef<SVGPathElement>(null);
  const clipEl = useRef<SVGPathElement>(null);
  const shown = useRef<number[] | null>(null);
  const from = useRef(shape);
  useLayoutEffect(() => {
    if (from.current === shape) return;
    const start = shown.current ?? measure(from.current);
    const end = measure(shape);
    from.current = shape;
    if (still) {
      shown.current = end;
      const d = outline(end);
      bodyEl.current?.setAttribute("d", d);
      clipEl.current?.setAttribute("d", d);
      return;
    }
    const t0 = performance.now();
    const ms = 520;
    let raf = 0;
    const step = (now: number) => {
      const u = Math.min(1, (now - t0) / ms);
      const c = 1.3;
      const e = 1 + (c + 1) * Math.pow(u - 1, 3) + c * Math.pow(u - 1, 2);
      const r = start.map((a, i) => a + (end[i] - a) * e);
      shown.current = r;
      const d = outline(r);
      bodyEl.current?.setAttribute("d", d);
      clipEl.current?.setAttribute("d", d);
      if (u < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [shape, still]);

  return (
    <div
      className="eyt"
      data-fill={fill}
      ref={box}
      style={{ "--eyt-size": `${s}px` } as React.CSSProperties}
      role="img"
      aria-label="A ball with two eyes that follows the cursor"
    >
      <svg className="eyt-ball" ref={ball} viewBox="0 0 100 100" data-poke={idle ? undefined : true} onClick={poke}>
        <defs>
          <clipPath id={clip}>
            <path ref={clipEl} d={first} />
          </clipPath>
          <filter id={`${clip}-soft`} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="1.1" />
          </filter>
        </defs>
        <path ref={bodyEl} className="eyt-body" d={first} />
        <g clipPath={`url(#${clip})`}>
          {[0, 1].map((i) => (
            <g key={i} ref={(n) => { eyes.current[i] = n; }}>
              <rect className="eyt-eye" x={-eye.w / 2} y={-eye.h / 2} width={eye.w} height={eye.h} rx={eye.r} />
              <rect className="eyt-lid" width={0} height={0} />
              <circle className="eyt-cheek" r={0} />
              <ellipse className="eyt-blush" filter={`url(#${clip}-soft)`} rx={0} ry={0} opacity={0} />
            </g>
          ))}
        </g>
      </svg>
      {idle || !speech ? null : (
        <span className="eyt-say" data-on={talking || undefined} aria-live="polite" style={{ "--tint": tint } as React.CSSProperties}>
          <span>{typed}</span>
          <span className="eyt-caret" />
        </span>
      )}
    </div>
  );
}
