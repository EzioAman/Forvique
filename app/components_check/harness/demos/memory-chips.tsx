"use client";
import { useState } from "react";
import { MemoryChips, type MemoryChange, type MemoryChip } from "@harness/components/memory-chips";
import type { V } from "../types";

const TEXTS = ["Prefers pnpm", "Uses Next.js 16", "Tabs over spaces", "Deploys on Fridays", "Works in IST", "Avoids new dependencies"];
const MIXED: MemoryChange[] = ["added", "updated", "existing", "existing", "added", "existing"];

export default function Demo({ v }: { v: V }) {
  const [forgotten, setForgotten] = useState<string[]>([]);
  const chips: MemoryChip[] = TEXTS.slice(0, Number(v.chips))
    .map((text, i) => ({
      id: String(i),
      text,
      change: v.change === "New" ? "added" : v.change === "Existing" ? "existing" : MIXED[i],
    }))
    .filter((c) => !forgotten.includes(c.id));
  return (
    <MemoryChips
      chips={chips}
      onForget={v.forget === "On" ? (id) => setForgotten((f) => [...f, id]) : undefined}
    />
  );
}
