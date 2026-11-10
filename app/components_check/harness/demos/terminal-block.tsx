"use client";
import { useEffect, useState } from "react";
import { TerminalBlock } from "@harness/components/terminal-block";
import type { V } from "../types";

const LINES = [
  "\u001b[90m> forvique@0.1.0 test\u001b[0m",
  " \u001b[32m✓\u001b[0m lib/search.test.ts (4 tests) 18ms",
  " \u001b[32m✓\u001b[0m lib/settings.test.ts (7 tests) 25ms",
  " \u001b[32m✓\u001b[0m components/thread.test.tsx (12 tests) 141ms",
  " \u001b[1mTest Files\u001b[0m  \u001b[32m3 passed\u001b[0m (3)",
  " \u001b[1mTests\u001b[0m  \u001b[32m23 passed\u001b[0m (23)",
];
const STDERR = ["FAIL components/thread.test.tsx > renders composer", "AssertionError: expected 'Send' to be 'Submit'"];

export default function Demo({ v }: { v: V }) {
  const failed = v.outcome === "Failed";
  const total = LINES.length + (failed ? STDERR.length : 0);
  const stream = v.stream === "On";
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!stream) return;
    // reveal one line at a time, hold the finished state, then start over
    const t = setInterval(() => setN((k) => (k >= total + 3 ? 0 : k + 1)), 600);
    return () => clearInterval(t);
  }, [stream, total]);
  return (
    <TerminalBlock
      command="pnpm test"
      lines={LINES}
      stderr={failed ? STDERR : undefined}
      visibleCount={stream ? Math.min(n, total) : total}
      done={!stream || n >= total}
      exitCode={failed ? 1 : 0}
      variant={v.variant === "Ink" ? "ink" : "paper"}
      cwd={v.cwd === "On" ? "~/forvique" : undefined}
      durationMs={v.duration === "On" ? 2340 : undefined}
      maxCollapsedLines={v.collapse === "On" ? 3 : undefined}
      truncated={v.truncated === "On"}
    />
  );
}
