"use client";
import { useEffect, useState } from "react";
import { RunActivity, type RunActivityEntry, type RunActivityStatus } from "@harness/components/run-activity";
import type { V } from "../types";

const ENTRIES: RunActivityEntry[] = [
  { id: "1", kind: "commentary", label: "Looking at the failing CI job", content: "Looking at the failing CI job." },
  { id: "2", kind: "tool", label: "Read .github/workflows/test.yml", content: "Read .github/workflows/test.yml" },
  { id: "3", kind: "tool", label: "Ran pnpm test --filter api", content: "Ran pnpm test --filter api (2 failed)" },
  { id: "4", kind: "commentary", label: "CI uses an older Node than local", content: "CI uses an older Node than local." },
  { id: "5", kind: "tool", label: "Edited .nvmrc", content: "Edited .nvmrc: 18 to 22" },
  { id: "6", kind: "tool", label: "Ran pnpm test --filter api", content: "Ran pnpm test --filter api (all passed)" },
];

const LABEL: Record<RunActivityStatus, string> = {
  running: "Working",
  "requires-action": "Waiting for you",
  complete: "Worked for",
  cancelled: "Stopped after",
  incomplete: "Ran out of steps after",
  error: "Failed after",
};

export default function Demo({ v }: { v: V }) {
  const status = v.status as RunActivityStatus;
  const [open, setOpen] = useState(false);
  const [s, setS] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setS((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <RunActivity
      status={status}
      statusLabel={LABEL[status]}
      durationLabel={v.duration === "On" ? (status === "running" ? `${s}s` : "42s") : undefined}
      entries={ENTRIES.slice(0, Number(v.entries))}
      open={open}
      onOpenChange={setOpen}
      attention={v.attention === "On" ? <p className="text-sm">Allow the agent to run pnpm install?</p> : undefined}
    >
      {v.answer === "On" ? <p className="text-sm">CI was on Node 18. I pinned Node 22 in .nvmrc and the API tests pass now.</p> : null}
    </RunActivity>
  );
}
