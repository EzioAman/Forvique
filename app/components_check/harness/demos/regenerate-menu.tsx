"use client";
import { RegenerateMenu, type RegenerateOption } from "@harness/components/regenerate-menu";
import type { V } from "../types";

const OPTIONS: RegenerateOption[] = [
  { id: "sonnet", label: "Claude Sonnet", detail: "balanced" },
  { id: "opus", label: "Claude Opus", detail: "deeper" },
  { id: "haiku", label: "Claude Haiku", detail: "faster" },
  { id: "gpt", label: "GPT-4.1", detail: "1M context" },
  { id: "gemini", label: "Gemini 2.5 Pro", detail: "search" },
];

export default function Demo({ v }: { v: V }) {
  return (
    <RegenerateMenu
      options={OPTIONS.slice(0, Number(v.options))}
      open={v.open === "On"}
      currentId="sonnet"
      onOpenChange={v.trigger === "On" ? () => {} : undefined}
      onPick={() => {}}
    />
  );
}
