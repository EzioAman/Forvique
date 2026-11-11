"use client";
import { useState } from "react";
import { ApprovalCard, type ApprovalState } from "@harness/components/approval-card";
import type { V } from "../types";

const STATE: Record<string, ApprovalState> = { Request: "request", Running: "running", Done: "done", Denied: "denied" };

export default function Demo({ v }: { v: V }) {
  // a click overrides the picked state until the option changes
  const [picked, setPicked] = useState<{ from: string | number; state: ApprovalState }>();
  const state = picked?.from === v.state ? picked.state : STATE[v.state] ?? "request";
  const pick = (s: ApprovalState) => () => setPicked({ from: v.state, state: s });
  const destructive = v.variant === "Destructive";
  return (
    <ApprovalCard
      state={state}
      variant={destructive ? "destructive" : "default"}
      title={destructive ? "Delete build cache" : "Run shell command"}
      subtitle="Coding agent wants to run a command"
      description={v.description === "On" ? "Needed to reinstall dependencies after the lockfile changed." : undefined}
      command={v.command === "On" ? (destructive ? "rm -rf node_modules .next" : "pnpm install --frozen-lockfile") : undefined}
      details={v.details === "On" ? [{ label: "cwd", value: "~/projects/forvique" }, { label: "timeout", value: "120s" }] : undefined}
      onAllowOnce={pick("running")}
      onAlwaysAllow={v.always === "On" ? pick("running") : undefined}
      onDeny={pick("denied")}
    />
  );
}
