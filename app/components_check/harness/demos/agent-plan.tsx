"use client";
import { useEffect, useState } from "react";
import { AgentPlan } from "@harness/components/agent-plan";
import type { V } from "../types";

const STEPS = [
  { label: "Read the issue", description: "Issue #482: dark mode toggle resets on reload." },
  { label: "Find the theme store", description: "Searching for where the theme is persisted." },
  { label: "Reproduce the bug", description: "Toggling and reloading in the dev server." },
  { label: "Persist to localStorage", description: "Writing the theme on change, reading it on load." },
  { label: "Add a test", description: "Covering reload after a toggle." },
  { label: "Run the suite", description: "Running unit and e2e tests." },
  { label: "Update the changelog", description: "Adding a line under Fixes." },
  { label: "Open a pull request", description: "Linking it to issue #482." },
];

export default function Demo({ v }: { v: V }) {
  const steps = STEPS.slice(0, Number(v.steps)).map((s) => (v.descriptions === "On" ? s : s.label));
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((n) => n + 1), 1500);
    return () => clearInterval(t);
  }, []);
  return (
    <AgentPlan
      steps={steps}
      // Loop through every step, then hold the finished plan for one tick.
      activeIndex={i % (steps.length + 2)}
      title={v.title === "Long" ? "Fix dark mode not persisting across page reloads" : undefined}
    />
  );
}
