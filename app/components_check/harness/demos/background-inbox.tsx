"use client";
import { useEffect, useState } from "react";
import { BackgroundInbox, type BackgroundRun, type BackgroundState } from "@harness/components/background-inbox";
import type { V } from "../types";

const RUNS = [
  { title: "Fix flaky checkout test", summary: "1 file changed, tests pass" },
  { title: "Upgrade React to 19.2", summary: "14 files changed" },
  { title: "Audit npm dependencies", summary: "2 high severity found" },
  { title: "Write API docs for /search", summary: "Added 3 pages" },
  { title: "Profile the build", summary: "Build is 38% faster" },
];

const MIX: Record<string, BackgroundState[]> = {
  Mixed: ["ready", "running", "failed", "running", "ready"],
  "All running": ["running"],
  "All ready": ["ready"],
};

export default function Demo({ v }: { v: V }) {
  const [s, setS] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setS((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);
  const mix = MIX[v.mix as string] ?? MIX.Mixed;
  const runs: BackgroundRun[] = RUNS.slice(0, Number(v.runs)).map((r, i) => {
    const state = mix[Math.min(i, mix.length - 1)];
    return {
      id: String(i),
      title: r.title,
      state,
      elapsed: state === "running" ? `${s + i * 17}s` : `${2 + i}m`,
      summary: v.summary === "On" && state !== "running" ? (state === "failed" ? "Sandbox ran out of memory" : r.summary) : undefined,
    };
  });
  return <BackgroundInbox runs={runs} onCollect={v.collect === "On" ? () => {} : undefined} />;
}
