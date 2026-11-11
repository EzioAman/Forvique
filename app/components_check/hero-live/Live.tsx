"use client";
/* eslint-disable react-hooks/set-state-in-effect -- the demo loop resets its own state each time the scene changes */
import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion, useScroll, useSpring, useTransform, type MotionValue } from "framer-motion";
import { ArrowRight, Check } from "lucide-react";
import "./live.css";

/* Concept: a hero where the product is shown working. A looping demo cycles Forvique's services; every
   request and result here is sample copy for a concept preview, not a real customer or result. */
const SCENES = [
  { tag: "Attendance", ask: "Mark Priya present for today", done: "Done. Priya is marked present, 9:02 AM." },
  { tag: "AI assistant", ask: "Reply to Aman's refund question", done: "Drafted a reply and sent it to you for approval." },
  { tag: "CRM", ask: "Show me this week's new leads", done: "12 new leads, 4 look hot. Added to your CRM." },
  { tag: "Web", ask: "Build a landing page for my bakery", done: "Page drafted. Preview ready in under a minute." },
  { tag: "Reports", ask: "Aaj ka attendance report bhejo", done: "Report bhej diya. Check your inbox." },
] as const;

const LINES = ["Describe it.", "See it working.", "Change it in your words.", "Launch when it feels right."];

/* one line that darkens as it scrolls into the middle of the screen */
function Reveal({ text, i, p }: { text: string; i: number; p: MotionValue<number> }) {
  const a = 0.18 + i * 0.16;
  const color = useTransform(p, [a, a + 0.14], ["#dcdce2", "#14141a"]);
  return <motion.div style={{ color }}>{text}</motion.div>;
}

export function Live() {
  const still = useReducedMotion();
  const [scene, setScene] = useState(0);
  const [typed, setTyped] = useState("");
  const [phase, setPhase] = useState<"listen" | "done">("listen");
  const story = useRef<HTMLDivElement>(null);

  /* page progress bar and the scroll-driven headline */
  const { scrollYProgress } = useScroll();
  const bar = useSpring(scrollYProgress, { stiffness: 120, damping: 24 });
  const { scrollYProgress: sp } = useScroll({ target: story, offset: ["start 85%", "end 35%"] });

  /* the demo loop: listen (type the request), show the result, next scene */
  useEffect(() => {
    const s = SCENES[scene];
    let i = 0;
    let id = 0;
    setTyped("");
    setPhase("listen");
    if (still) { setTyped(s.ask); setPhase("done"); id = window.setTimeout(() => setScene((n) => (n + 1) % SCENES.length), 4000); return () => clearTimeout(id); }
    const type = () => {
      i++;
      setTyped(s.ask.slice(0, i));
      if (i < s.ask.length) id = window.setTimeout(type, 38 + Math.random() * 30);
      else id = window.setTimeout(() => { setPhase("done"); id = window.setTimeout(() => setScene((n) => (n + 1) % SCENES.length), 2600); }, 500);
    };
    id = window.setTimeout(type, 700);
    return () => clearTimeout(id);
  }, [scene, still]);

  const s = SCENES[scene];
  return (
    <div className="lv">
      <motion.div className="lv-bar" style={{ scaleX: bar }} />
      <header className="lv-nav">
        <b>forvique</b>
        <nav><a>Services</a><a>Work</a><a>Pricing</a><a>Contact</a></nav>
        <button className="lv-dark">Start a project</button>
      </header>

      <section className="lv-hero">
        <motion.p initial={still ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="lv-eyebrow">Forvique</motion.p>
        <motion.h1 initial={still ? false : { opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.8 }}>Just describe it.</motion.h1>
        <motion.p initial={still ? false : { opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25, duration: 0.8 }} className="lv-sub">Software, built from a sentence.</motion.p>
        <motion.div initial={still ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }} className="lv-cta">
          <button className="lv-dark">Try a preview <ArrowRight size={15} /></button>
          <button className="lv-ghost">See our work</button>
        </motion.div>

        {/* the device: the product working, on loop */}
        <motion.div className="lv-device" initial={still ? false : { opacity: 0, y: 60 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5, duration: 1, ease: [0.2, 0.8, 0.2, 1] }}>
          <div className="lv-screen">
            <aside>
              <b>Forvique</b>
              <span data-on>+ New chat</span>
              <small>Recents</small>
              {SCENES.map((x, k) => <span key={x.tag} data-cur={k === scene || undefined}>{x.tag}</span>)}
            </aside>
            <main>
              <div className="lv-state">{phase === "listen" ? "Listening…" : s.tag}</div>
              <div className="lv-wave" data-still={phase === "done" || undefined} aria-hidden="true">
                {Array.from({ length: 13 }).map((_, k) => <i key={k} style={{ animationDelay: `${(k % 5) * 0.12}s` }} />)}
              </div>
              <p className="lv-ask">{typed}<span className="lv-caret" /></p>
              <p className="lv-done" data-show={phase === "done" || undefined}><Check size={14} /> {s.done}</p>
            </main>
          </div>
          <div className="lv-base" />
        </motion.div>
        <p className="lv-note">Concept preview. Sample requests, not real customer data.</p>
      </section>

      <section className="lv-story" ref={story}>
        {LINES.map((t, i) => <Reveal key={t} text={t} i={i} p={sp} />)}
      </section>
    </div>
  );
}
