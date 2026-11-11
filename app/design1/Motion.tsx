"use client";
import { useEffect } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";

gsap.registerPlugin(ScrollTrigger, SplitText);

/* All of the page's motion, kept out of the markup: the page stays a server component and reads fine
   with this file removed. It finds its targets by class and by two attributes:
   data-in (hero pieces, hidden by home.css until the entrance plays) and data-reveal (fade up on scroll).
   Nothing runs under reduced motion; the page is then simply static. */
export function Motion() {
  useEffect(() => {
    const mm = gsap.matchMedia();
    mm.add("(prefers-reduced-motion: no-preference)", () => {
      /* entrance: the tab drops in, the headline rises letter by letter, the ball lands, the rest follows */
      const title = SplitText.create(".fv-hero h1", { type: "chars" });
      gsap.timeline({ defaults: { ease: "power3.out", duration: 0.8 } })
        .set(".fv-hero h1", { opacity: 1 })
        .fromTo(".fv-notch", { yPercent: -110, opacity: 1 }, { yPercent: 0 }, 0)
        .from(title.chars, { yPercent: 60, opacity: 0, rotate: 4, duration: 0.9, ease: "power4.out", stagger: 0.035 }, 0.1)
        .fromTo(".fv-nav", { opacity: 0, y: -10 }, { opacity: 1, y: 0 }, 0.25)
        .fromTo(".fv-ball", { opacity: 0, y: 70, scale: 0.82 }, { opacity: 1, y: 0, scale: 1, duration: 1.1, ease: "back.out(1.5)" }, 0.35)
        .fromTo(".fv-lede, .fv-note", { opacity: 0, y: 18 }, { opacity: 1, y: 0, stagger: 0.12 }, 0.8)
        .fromTo(".fv-cut", { opacity: 1, yPercent: 110 }, { yPercent: 0 }, 0.9);

      /* depth: the headline scrolls slower than the slab, so it sinks behind the ball */
      gsap.to(".fv-hero h1", { yPercent: 22, ease: "none", scrollTrigger: { trigger: ".fv-hero", start: "top top", end: "bottom top", scrub: true } });

      /* the statement inks itself in as it is read */
      const say = SplitText.create(".fv-say", { type: "words,chars" });
      gsap.fromTo(say.chars, { color: "#b9b0a4" }, {
        color: "#17120e", ease: "none", stagger: 0.05,
        scrollTrigger: { trigger: ".fv-say", start: "top 82%", end: "bottom 50%", scrub: 0.4 },
      });

      /* everything else fades up as it arrives; pieces arriving together are staggered */
      gsap.set("[data-reveal]", { opacity: 0, y: 30 });
      ScrollTrigger.batch("[data-reveal]", {
        start: "top 90%", once: true,
        onEnter: (els) => gsap.to(els, { opacity: 1, y: 0, duration: 0.9, ease: "power3.out", stagger: 0.09, overwrite: true }),
      });
      gsap.from(".fv-sign .su-bar", { yPercent: 130, duration: 0.9, ease: "power3.out", scrollTrigger: { trigger: ".fv-sign", start: "top 55%", once: true } });

      /* the display font changes the headline's height once it loads */
      document.fonts?.ready.then(() => ScrollTrigger.refresh());
    });
    return () => mm.revert();
  }, []);
  return null;
}
