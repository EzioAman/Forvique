"use client";
import { OptionList } from "@harness/components/option-list";
import type { V } from "../types";

const OPTIONS = [
  { id: "pnpm", label: "pnpm", description: "Fast, disk-efficient, what the repo already uses" },
  { id: "npm", label: "npm", description: "Ships with Node, no extra install" },
  { id: "bun", label: "bun", description: "Fastest install, newer runtime" },
  { id: "yarn", label: "yarn", description: "Plug'n'Play, zero-installs" },
  { id: "deno", label: "deno", description: "Built-in npm compatibility" },
  { id: "none", label: "Skip install", description: "I will install dependencies myself" },
];

export default function Demo({ v }: { v: V }) {
  const options = OPTIONS.slice(0, Number(v.count)).map((o, i) => ({
    ...o,
    description: v.descriptions === "On" ? o.description : undefined,
    disabled: v.disabled === "On" && i === 1,
  }));
  return (
    <OptionList
      key={JSON.stringify(v)}
      options={options}
      selectionMode={v.mode as "single" | "multiple"}
      maxSelections={v.mode === "multiple" ? Number(v.max) : undefined}
      onConfirm={v.interactive === "On" ? () => new Promise((r) => setTimeout(r, 800)) : undefined}
      choice={v.receipt === "On" ? ["pnpm"] : undefined}
    />
  );
}
