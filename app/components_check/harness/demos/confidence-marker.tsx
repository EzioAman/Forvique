"use client";
import { useState } from "react";
import { ConfidenceMarker, type ConfidenceClaim } from "@harness/components/confidence-marker";
import type { V } from "../types";

const CLAIMS: ConfidenceClaim[] = [
  { id: "g", text: "The outage began at 14:02 UTC when the cache cluster ran out of memory.", confidence: "grounded", basis: "incident log" },
  { id: "i", text: "It was likely triggered by the new session-pinning deploy,", confidence: "inferred", basis: "deploy timing" },
  { id: "u", text: "and may have affected EU customers too.", confidence: "uncertain", basis: "no regional data" },
];
const ID: Record<string, string> = { None: "", Grounded: "g", Inferred: "i", Uncertain: "u" };

export default function Demo({ v }: { v: V }) {
  // hovering overrides the picked claim until the option changes
  const [hover, setHover] = useState<{ from: string | number; id: string }>();
  const hoveredId = hover?.from === v.highlight ? hover.id : ID[v.highlight] ?? "";
  return (
    <ConfidenceMarker
      claims={CLAIMS}
      hoveredId={hoveredId}
      onHover={(id) => setHover({ from: v.highlight, id })}
    />
  );
}
