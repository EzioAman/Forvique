import Link from "next/link";
import { Anton } from "next/font/google";
import { ArrowDown, ArrowUpRight } from "lucide-react";
import { Seek } from "../../components/Seek";
import { Watcher } from "../../components/Watcher";
import { Motion } from "./Motion";
import "./home.css";

/* The Forvique landing page. Everything that moves on it is a real component from /components_check,
   so the page is itself the proof of the work. The main action opens the Harness web app (a separate deployment).
   Set NEXT_PUBLIC_HARNESS_URL to wherever Harness web is deployed, e.g. https://harness.example.com/harness.
   Unset, it points at /harness on this same site, which only works if Harness is served from here.
   Motion lives in Motion.tsx; data-in and data-reveal mark what it animates. */
const HARNESS_URL = process.env.NEXT_PUBLIC_HARNESS_URL ?? "/harness";

const display = Anton({ weight: "400", subsets: ["latin"], variable: "--font-display" });

const STEPS = ["Describe it.", "See it working.", "Change it in your words.", "Launch when it feels right."];

export default function Design1() {
  return (
    <div className={`fv ${display.variable}`}>
      <Motion />
      <a className="fv-skip" href="#main">Skip to content</a>

      <header className="fv-hero">
        <Link className="fv-notch" href="/" aria-label="Forvique, home" data-in>forvique</Link>
        <nav className="fv-nav" aria-label="Main" data-in>
          <div>
            <a href="#approach">Approach</a>
            <a href="#work">Work</a>
          </div>
          <div>
            <Link href="/components_check">Components</Link>
            <a className="fv-pill" data-light href={HARNESS_URL}>Open Harness</a>
          </div>
        </nav>

        <h1 data-in>Feel it first</h1>

        <div className="fv-stage">
          <div className="fv-ball" data-in>
            <Watcher within=".fv-hero" follow={70} />
          </div>
          <p className="fv-lede" data-in>
            Forvique builds high quality AI products for your business. You try them working before you commit.
            <br />
            <a href="#approach">How we work <ArrowDown size={15} /></a>
          </p>
          <p className="fv-note" data-in>It is watching your cursor. Go on, poke it.</p>
        </div>

        <div className="fv-cut" data-in>
          <a className="fv-pill" href={HARNESS_URL}>Open Harness <ArrowUpRight size={17} /></a>
        </div>
      </header>

      <main id="main">
        <section className="fv-sec fv-a" id="approach" aria-labelledby="approach-title">
          <figure className="fv-fig" data-reveal>
            <div className="fv-try"><Seek width={260} /></div>
            <figcaption>This search field is live. Click the lens, then move your cursor near it.</figcaption>
          </figure>
          <div>
            <p className="fv-chip" data-reveal>How we work</p>
            <h2 className="fv-say" id="approach-title">
              You describe it, we build it, and you use the real thing{" "}
              <span>before you decide. No slides, no mockups.</span>
            </h2>
            <ol className="fv-steps">
              {STEPS.map((s) => <li key={s} data-reveal>{s}</li>)}
            </ol>
          </div>
        </section>

        <section className="fv-sec fv-b" id="work" aria-labelledby="work-title">
          <div>
            <div className="fv-trio" aria-hidden="true" data-reveal>
              <Watcher idle size={40} shape="Ball" />
              <Watcher idle size={40} shape="Cube" />
              <Watcher idle size={40} shape="Hexagon" />
            </div>
            <h2 id="work-title" data-reveal>Small details.<br />Whole products.</h2>
            <p data-reveal>
              Nothing moving on this page is a video. Each piece is a working component from our bench, tuned until it
              feels right, then built into the product.
            </p>
            <div className="fv-pair">
              <a href={HARNESS_URL} data-reveal>
                <h3>Harness <ArrowUpRight size={16} /></h3>
                Our coding agent. It plans, uses tools and hands every change back for review.
              </a>
              <Link href="/components_check" data-dark data-reveal>
                <h3>The bench <ArrowUpRight size={16} /></h3>
                Every component we ship, live, with its settings open.
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="fv-foot">
        <p>forvique</p>
        <nav aria-label="Footer">
          <a href={HARNESS_URL}>Harness</a>
          <Link href="/components_check">Components</Link>
        </nav>
        <small>© 2026 Forvique</small>
      </footer>
    </div>
  );
}
