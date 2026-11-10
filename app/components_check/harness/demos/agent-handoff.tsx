"use client";
import { AgentHandoff } from "@harness/components/agent-handoff";
import type { V } from "../types";

const CARRIED = [
  "The failing test is checkout.e2e.ts, step 4.",
  "Stripe test keys are in .env.test.",
  "The user wants no changes to the public API.",
  "Node 22, pnpm 9.",
];

const LONG =
  "The research agent found the root cause in the payment webhook, so the coding agent takes over to write the fix and a regression test.";

export default function Demo({ v }: { v: V }) {
  return (
    <AgentHandoff
      from="Researcher"
      to="Coder"
      reason={v.reason === "Long" ? LONG : "Root cause found, handing off to write the fix."}
      carried={CARRIED.slice(0, Number(v.carried))}
      settled={v.settled === "On"}
    />
  );
}
