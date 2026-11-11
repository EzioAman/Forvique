"use client";
import { useEffect, useState } from "react";
import { JobProgress } from "@harness/components/job-progress";
import type { V } from "../types";

type Outcome = "success" | "partial" | "failed" | "cancelled";

const STAGES = [
  { name: "clone", weight: 1, description: "Cloning acme/web at main." },
  { name: "install", weight: 2, description: "Installing 1,204 packages with pnpm." },
  { name: "build", weight: 3, description: "Building 14 routes for production." },
  { name: "test", weight: 2, description: "Running 312 tests across 4 workers." },
];

const SUMMARY: Record<Outcome, string> = {
  success: "Build and tests passed. Preview is ready.",
  partial: "Build passed, 3 tests were skipped as flaky.",
  failed: "The build failed: missing env var DATABASE_URL.",
  cancelled: "Cancelled during the build.",
};

const STEPS = 10; // progress ticks per stage
const TICK = 300;

export default function Demo({ v }: { v: V }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setN((c) => c + 1), TICK);
    return () => clearInterval(t);
  }, []);
  const status = v.outcome === "Running" ? undefined : (v.outcome as Outcome);
  // Loop all stages, then hold the finished bar for one stage's worth of ticks.
  const loop = n % ((STAGES.length + 1) * STEPS);
  return (
    <JobProgress
      title="Deploy preview"
      stages={v.stageDetails === "On" ? STAGES : STAGES.map(({ name, weight }) => ({ name, weight }))}
      stageIndex={status === "success" ? STAGES.length : status ? 2 : Math.floor(loop / STEPS)}
      stageProgress={status ? 0.5 : (loop % STEPS) / STEPS}
      eta={`~${Math.ceil(Math.max(0, STAGES.length * STEPS - loop) * TICK / 1000)}s`}
      onCancel={v.cancel === "On" ? () => {} : undefined}
      outcome={status && { status, summary: v.summary === "On" ? SUMMARY[status] : undefined }}
      elapsedMs={v.elapsed === "On" ? 94_000 : undefined}
    />
  );
}
