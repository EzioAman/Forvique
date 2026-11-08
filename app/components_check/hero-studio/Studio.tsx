"use client";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { Watcher } from "../watcher/Watcher";
import "./studio.css";

/* Concept only: the hero as a lit studio set. The Watcher is the product on the plinth; the cards are
   concept previews of what Forvique builds, angled toward it. Entrance via framer-motion. */

/* a fixed scatter, not Math.random(): keeps server and client markup identical */
const DUST = [
  [38, 22, 7, 0], [46, 30, 9, 1.4], [54, 18, 8, 2.2], [61, 34, 10, 0.6], [43, 42, 9, 3.1], [57, 46, 7, 1.9],
  [49, 14, 11, 2.7], [34, 38, 8, 3.6], [65, 26, 9, 1.1], [51, 52, 10, 0.3], [40, 56, 8, 2.4], [60, 58, 11, 3.3],
];

export function Studio() {
  const still = useReducedMotion();
  /* each piece rises into place; with reduced motion they simply appear */
  const rise = (delay: number, y = 18) => ({
    initial: still ? false : { opacity: 0, y },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.9, delay, ease: [0.2, 0.8, 0.2, 1] as const },
  });

  return (
    <section className="hs board" aria-label="Hero concept">
      <motion.div className="hs-light" initial={still ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 1.6 }} />
      <motion.div className="hs-beam" initial={still ? false : { opacity: 0 }} animate={{ opacity: 0.7 }} transition={{ duration: 1.8, delay: 0.2 }} />
      <div className="hs-floor" />
      <div className="hs-ring" data-i="1" />
      <div className="hs-ring" data-i="0" />
      <div className="hs-shadow" />
      {DUST.map(([x, y, d, t], i) => (
        <span key={i} className="hs-dust" style={{ left: `${x}%`, top: `${y}%`, "--d": `${d}s`, "--t": `${t}s` } as React.CSSProperties} />
      ))}

      <motion.div className="hs-obj-wrap" {...rise(0.35, 40)} style={{ position: "absolute", inset: 0, zIndex: 3, pointerEvents: "none" }}>
        <div className="hs-obj" style={{ pointerEvents: "auto" }}>
          <Watcher size={180} shape="Ball" fill="Dark" follow={60} />
        </div>
      </motion.div>

      <div className="hs-stage3d">
        <motion.div {...rise(0.7)} style={{ position: "absolute", inset: 0 }}>
          <button className="hs-card" data-side="l" style={{ left: "4%", top: "34%" }}>
            <h3>Assistant <em>concept</em></h3>
            <span className="hs-bub">How do refunds work?</span>
            <span className="hs-bub" data-me>Within 14 days.</span>
            <div className="hs-ln" style={{ width: "70%", clear: "both" }} />
          </button>
          <button className="hs-card" data-side="l" style={{ left: "9%", top: "58%" }}>
            <h3>Documents <em>concept</em></h3>
            <div className="hs-ln" data-b style={{ width: "55%" }} />
            <div className="hs-ln" style={{ width: "92%" }} />
            <div className="hs-ln" style={{ width: "80%" }} />
            <div className="hs-ln" data-b style={{ width: "40%" }} />
          </button>
          <button className="hs-card" data-side="r" style={{ right: "4%", top: "34%" }}>
            <h3>Insights <em>concept</em></h3>
            <div className="hs-bars">
              <i style={{ height: "40%" }} /><i style={{ height: "62%" }} /><i data-on style={{ height: "90%" }} /><i style={{ height: "55%" }} /><i style={{ height: "72%" }} />
            </div>
          </button>
          <button className="hs-card" data-side="r" style={{ right: "9%", top: "58%" }}>
            <h3>Automations <em>concept</em></h3>
            <div className="hs-flow"><i /><u /><i /><u /><i /></div>
            <div className="hs-ln" style={{ width: "60%", marginTop: 14 }} />
          </button>
        </motion.div>
      </div>

      <div className="hs-vig" />
      <svg className="hs-grain" width="100%" height="100%" aria-hidden="true">
        <filter id="hs-n"><feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="2" stitchTiles="stitch" /></filter>
        <rect width="100%" height="100%" filter="url(#hs-n)" />
      </svg>

      <motion.div className="hs-nav" {...rise(0.1, -10)}>
        <b>forvique</b>
        <nav><span>Products</span><span>Work</span><span>Contact</span></nav>
        <button className="hs-btn" style={{ height: 36 }}>Talk to us</button>
      </motion.div>

      <div className="hs-copy">
        <motion.span className="hs-tag" {...rise(0.2)}><i />Concept previews, try them</motion.span>
        <motion.h1 {...rise(0.3)}>AI products you can feel<br /><span>before you buy.</span></motion.h1>
        <motion.p {...rise(0.45)}>Try interactive prototypes of what we build, then decide. Nothing here is a finished product or a client claim.</motion.p>
      </div>

      <motion.div className="hs-cta" {...rise(0.9)}>
        <button className="hs-btn" data-p>Start a project <ArrowRight size={16} /></button>
        <button className="hs-btn">Try a preview</button>
      </motion.div>
    </section>
  );
}
