"use client";
import { useState } from "react";
import { ReasoningEffort, type EffortLevel } from "@harness/components/reasoning-effort";
import type { V } from "../types";

const LEVELS: EffortLevel[] = [
  { key: "low", label: "Low", budget: 2000 },
  { key: "medium", label: "Medium", budget: 8000 },
  { key: "high", label: "High", budget: 32000 },
];

export default function Demo({ v }: { v: V }) {
  const [picked, setPicked] = useState<string | null>(null);
  const key = picked ?? String(v.level).toLowerCase();
  const budget = LEVELS.find((l) => l.key === key)?.budget ?? 0;
  return (
    <ReasoningEffort
      levels={LEVELS}
      selectedKey={key}
      spent={Math.round((budget * Number(v.spent)) / 100)}
      onSelect={v.selectable === "On" ? setPicked : undefined}
    />
  );
}
