"use client";
import { useEffect, useState } from "react";
import { AgentStatus, type AgentState } from "@harness/components/agent-status";
import type { V } from "../types";

const LONG = "Refactoring the payment service to use the new retry client across all handlers";

export default function Demo({ v }: { v: V }) {
  const [s, setS] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setS((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <AgentStatus
      state={v.state as AgentState}
      label={v.label === "Long" ? LONG : "Running tests"}
      elapsed={v.timer === "On" ? `${s}s` : undefined}
    />
  );
}
