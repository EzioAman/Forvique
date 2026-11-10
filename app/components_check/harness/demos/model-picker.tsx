"use client";
import { useState } from "react";
import { ModelPicker, type PickableModel } from "@harness/components/model-picker";
import type { V } from "../types";

const MODELS: PickableModel[] = [
  { id: "opus", name: "Claude Opus", family: "Anthropic", context: "200k", price: "$15/M", capabilities: ["reasoning", "tools", "vision"] },
  { id: "sonnet", name: "Claude Sonnet", family: "Anthropic", context: "200k", price: "$3/M", capabilities: ["tools", "vision"] },
  { id: "haiku", name: "Claude Haiku", family: "Anthropic", context: "200k", price: "$0.8/M", capabilities: ["fast"] },
  { id: "gpt", name: "GPT-4.1", family: "OpenAI", context: "1M", price: "$2/M", capabilities: ["tools", "vision"] },
  { id: "gemini", name: "Gemini 2.5 Pro", family: "Google", context: "1M", price: "$1.25/M", capabilities: ["reasoning", "search"] },
  { id: "llama", name: "Llama 4", family: "Meta", context: "128k", price: "$0.2/M", capabilities: ["open weights"] },
];

export default function Demo({ v }: { v: V }) {
  const [id, setId] = useState("opus");
  return (
    <ModelPicker
      models={MODELS.slice(0, Number(v.count))}
      selectedId={id}
      onSelect={v.selectable === "On" ? setId : undefined}
    />
  );
}
