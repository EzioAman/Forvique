"use client";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { Watcher } from "../../../components/Watcher";
import "./studio.css";

/* Concept only: the hero as a lit studio set. The Watcher is the product on the plinth; the cards are
   concept previews of what Forvique builds, angled toward it. Entrance via framer-motion. */

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

      <motion.div className="hs-obj-wrap" {...rise(0.35, 40)} style={{ position: "absolute", inset: 0, zIndex: 3, pointerEvents: "none" }}>
        <div className="hs-obj" style={{ pointerEvents: "auto" }}>
          <Watcher size={150} shape="Ball" fill="Dark" follow={60} />
        </div>
      </motion.div>

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
        <motion.h1 {...rise(0.3)}>AI products you can feel<br /><span>before you buy.</span></motion.h1>
      </div>

      <motion.div className="hs-cta" {...rise(0.9)}>
        <button className="hs-btn" data-p>Start a project <ArrowRight size={16} /></button>
        <button className="hs-btn">Try a preview</button>
      </motion.div>
    </section>
  );
}
