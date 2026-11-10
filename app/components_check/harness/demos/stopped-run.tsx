"use client";
import { StoppedRun } from "@harness/components/stopped-run";
import type { V } from "../types";

const SHORT = "I found the failing test in auth.spec.ts and";
const LONG =
  "I found the failing test in auth.spec.ts. The session cookie is set before the redirect, so the second request never sees it. I started moving the cookie write into the middleware and updating the three handlers that";
const REASON: Record<string, string> = { User: "stopped by you", Limit: "token limit", Timeout: "timed out" };

export default function Demo({ v }: { v: V }) {
  return (
    <StoppedRun
      words={(v.text === "Long" ? LONG : SHORT).split(" ")}
      reason={REASON[v.reason] ?? REASON.User}
      onContinue={() => {}}
      onDiscard={() => {}}
    />
  );
}
