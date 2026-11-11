"use client";
import { useEffect, useState } from "react";
import { CodeRunner, type RunState } from "@harness/components/code-runner";
import type { V } from "../types";

const CODE = "import statistics\nlatencies = [112, 98, 143, 120, 101]\nprint(statistics.mean(latencies))\nprint(max(latencies))";
const OK = ["114.8", "143"];
const ERROR = ["Traceback (most recent call last):", '  File "main.py", line 1', "ModuleNotFoundError: No module named 'statistic'"];
const STATE: Record<string, RunState> = { Idle: "idle", Running: "running", Ok: "ok", Error: "error" };

export default function Demo({ v }: { v: V }) {
  const state = STATE[v.state] ?? "ok";
  const [n, setN] = useState(0);
  useEffect(() => {
    if (state !== "running") return;
    const t = setInterval(() => setN((k) => (k + 1) % (OK.length + 2)), 900);
    return () => clearInterval(t);
  }, [state]);
  const output = state === "error" ? ERROR : state === "running" ? OK.slice(0, n) : OK;
  return (
    <CodeRunner
      language="python"
      code={CODE}
      state={state}
      output={output}
      durationMs={v.duration === "On" ? 42 : undefined}
      onRun={v.run === "On" ? () => {} : undefined}
    />
  );
}
