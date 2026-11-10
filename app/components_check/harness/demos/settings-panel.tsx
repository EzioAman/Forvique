"use client";
import { useState } from "react";
import { SettingsPanel, type SettingToggle } from "@harness/components/settings-panel";
import type { V } from "../types";

const MODELS = ["Opus", "Sonnet", "Haiku", "GPT-4.1"];
const TOGGLES: SettingToggle[] = [
  { key: "web", label: "Web search", detail: "Let the agent look things up", on: true },
  { key: "code", label: "Run code", detail: "Execute snippets in a sandbox", on: false },
  { key: "memory", label: "Memory", detail: "Remember facts across chats", on: true },
  { key: "approve", label: "Ask before edits", detail: "Confirm every file change", on: false },
];

export default function Demo({ v }: { v: V }) {
  const models = MODELS.slice(0, Number(v.models));
  const [model, setModel] = useState("Sonnet");
  const [prompt, setPrompt] = useState("You are a careful coding agent. Explain each change before you make it.");
  const [toggles, setToggles] = useState(TOGGLES);
  const edit = v.editable === "On";
  return (
    <SettingsPanel
      model={model}
      models={models}
      systemPrompt={prompt}
      temperature={Number(v.temperature)}
      toggles={toggles.slice(0, Number(v.toggles))}
      onModelChange={edit ? setModel : undefined}
      onSystemPromptChange={edit ? setPrompt : undefined}
      onTemperatureChange={() => {}}
      onToggle={edit ? (k) => setToggles((ts) => ts.map((t) => (t.key === k ? { ...t, on: !t.on } : t))) : undefined}
    />
  );
}
