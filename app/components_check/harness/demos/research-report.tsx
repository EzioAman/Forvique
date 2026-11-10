"use client";
import { useEffect, useState } from "react";
import { ResearchReport, type ReportSection, type SectionState } from "@harness/components/research-report";
import type { V } from "../types";

const SECTIONS = [
  { id: "1", heading: "Market size and growth", preview: "Agent tooling spend roughly doubled year over year, led by coding assistants." },
  { id: "2", heading: "Leading vendors", preview: "Three vendors hold most enterprise seats; open-source frameworks dominate prototypes." },
  { id: "3", heading: "Pricing models", preview: "Seat pricing is giving way to usage-based billing tied to tokens or tasks." },
  { id: "4", heading: "Adoption barriers", preview: "Security review and unclear ROI are the most cited blockers." },
  { id: "5", heading: "Regulatory outlook", preview: "New disclosure rules apply to automated decisions from next year." },
  { id: "6", heading: "Recommendations", preview: "Pilot with one workflow, measure task completion, then expand." },
];

export default function Demo({ v }: { v: V }) {
  const count = Number(v.sections);
  const live = v.mode === "Live";
  const [step, setStep] = useState(0);
  useEffect(() => {
    if (!live) return;
    // each section takes two ticks: writing, then done; hold at the end and restart
    const t = setInterval(() => setStep((k) => (k >= count * 2 + 2 ? 0 : k + 1)), 900);
    return () => clearInterval(t);
  }, [live, count]);
  const at = live ? step : count * 2;
  const sections: ReportSection[] = SECTIONS.slice(0, count).map((s, i) => {
    const state: SectionState = at >= i * 2 + 2 ? "done" : at >= i * 2 + 1 ? "writing" : "pending";
    return {
      id: s.id,
      heading: s.heading,
      state,
      sources: state === "pending" ? 0 : 3 + i,
      preview: v.previews === "On" && state === "done" ? s.preview : undefined,
    };
  });
  return (
    <ResearchReport
      title="State of AI agent tooling, 2026"
      sections={sections}
      sourcesRead={sections.reduce((n, s) => n + s.sources, 0)}
    />
  );
}
