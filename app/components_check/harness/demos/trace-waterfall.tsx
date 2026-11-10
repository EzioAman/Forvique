"use client";
import { useEffect, useState } from "react";
import { TraceWaterfall, type SpanStatus, type TraceSpan } from "@harness/components/trace-waterfall";
import type { V } from "../types";

const SPANS = [
  { name: "agent.run", depth: 0, startMs: 0, durationMs: 2400 },
  { name: "plan", depth: 1, startMs: 20, durationMs: 310 },
  { name: "tool.search", depth: 1, startMs: 340, durationMs: 620 },
  { name: "http.get", depth: 2, startMs: 360, durationMs: 540 },
  { name: "tool.read_file", depth: 1, startMs: 980, durationMs: 180 },
  { name: "llm.generate", depth: 1, startMs: 1180, durationMs: 900 },
  { name: "tool.write_file", depth: 1, startMs: 2100, durationMs: 120 },
  { name: "tool.run_tests", depth: 1, startMs: 2230, durationMs: 160 },
];

export default function Demo({ v }: { v: V }) {
  const count = Number(v.spans);
  const last = v.outcome as SpanStatus;
  const spans: TraceSpan[] = SPANS.slice(0, count).map((s, i) => ({
    id: String(i),
    ...s,
    // The root span and the newest span carry the outcome; the rest finished.
    status: i === 0 || i === count - 1 ? last : "completed",
  }));
  const [n, setN] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setN((c) => c + 1), 600);
    return () => clearInterval(t);
  }, []);
  // Reveal one span per tick, hold the full trace for 3 ticks, start over.
  const visibleCount = v.reveal === "On" ? Math.min(count, (n % (count + 3)) + 1) : count;
  return <TraceWaterfall spans={spans} totalMs={2400} visibleCount={visibleCount} />;
}
