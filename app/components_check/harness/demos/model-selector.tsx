"use client";
import {
  ModelSelectorContent,
  ModelSelectorRoot,
  ModelSelectorTrigger,
  type ModelOption,
} from "@harness/components/model-selector";
import type { V } from "../types";

const MODELS: ModelOption[] = [
  { id: "opus", name: "Claude Opus", description: "Deepest reasoning for hard tasks", efforts: true },
  { id: "sonnet", name: "Claude Sonnet", description: "Balanced speed and quality", efforts: true },
  { id: "haiku", name: "Claude Haiku", description: "Fast and cheap" },
  { id: "gpt", name: "GPT-4.1", description: "1M token context" },
];

type Variant = "outline" | "ghost" | "muted";
type Size = "default" | "sm" | "lg";

export default function Demo({ v }: { v: V }) {
  const models = v.effort === "On" ? MODELS : MODELS.map(({ efforts: _, ...m }) => m);
  return (
    // key remounts so the Open option re-applies as the starting state
    <ModelSelectorRoot
      key={`${v.open}-${v.effort}`}
      models={models}
      defaultValue="sonnet"
      defaultEffort="medium"
      defaultOpen={v.open === "On"}
    >
      <ModelSelectorTrigger variant={v.variant as Variant} size={v.size as Size} />
      <ModelSelectorContent searchable={v.searchable === "On"} align={v.align as "start" | "end"} />
    </ModelSelectorRoot>
  );
}
