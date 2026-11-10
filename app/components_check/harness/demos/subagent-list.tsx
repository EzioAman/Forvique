"use client";
import { useEffect, useState } from "react";
import { SubagentList } from "@harness/components/subagent-list";
import type { V } from "../types";

const AGENTS = [
  { name: "Search the docs", model: "haiku" },
  { name: "Read the codebase", model: "sonnet" },
  { name: "Check open issues", model: "haiku" },
  { name: "Scan dependencies", model: "haiku" },
  { name: "Draft the migration", model: "opus" },
];

export default function Demo({ v }: { v: V }) {
  const agents = AGENTS.slice(0, Number(v.agents));
  const [n, setN] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setN((c) => c + 1), 200);
    return () => clearInterval(t);
  }, []);
  // completedCount is index-based, so earlier agents run faster and finish first.
  const loop = n % 90;
  const progress = agents.map((_, i) => Math.min(100, loop * (10 - i * 1.5)));
  const completedCount = progress.filter((p) => p >= 100).length;
  return (
    <SubagentList
      agents={agents}
      completedCount={completedCount}
      progress={progress}
      showSummary={v.summary === "On" && completedCount === agents.length}
      summaryAgent={{ name: "Summarize findings", model: "sonnet" }}
    />
  );
}
