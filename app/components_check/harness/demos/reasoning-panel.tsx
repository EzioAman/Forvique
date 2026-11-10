"use client";
import { useEffect, useState } from "react";
import { ReasoningPanel } from "@harness/components/reasoning-panel";
import type { V } from "../types";

const STEPS = [
  { title: "Read the error", body: "TypeError in src/cart/total.ts: cannot read price of undefined." },
  { title: "Find the caller", body: "checkout() passes items before the inventory fetch resolves." },
  { title: "Check the tests", body: "No test covers an empty cart, so the bug slipped through." },
  { title: "Plan the fix", body: "Await the fetch and guard against missing items." },
  { title: "Write a test", body: "Add a case for an empty cart and for a removed product." },
  { title: "Verify", body: "Run the cart suite and the checkout end-to-end test." },
];

export default function Demo({ v }: { v: V }) {
  const steps = STEPS.slice(0, Number(v.steps));
  const [open, setOpen] = useState(true);
  const [s, setS] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setS((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);
  const streaming = v.state === "Streaming";
  return (
    <ReasoningPanel
      steps={steps}
      visibleSteps={streaming ? (s % steps.length) + 1 : steps.length}
      streaming={streaming}
      open={open}
      onOpenChange={setOpen}
      restingLabel="Thought for 12s"
      elapsed={v.timer === "On" ? `${s}s` : undefined}
    />
  );
}
