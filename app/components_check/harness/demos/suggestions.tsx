"use client";
import { useState } from "react";
import { Suggestions } from "@harness/components/suggestions";
import type { V } from "../types";

const ALL = [
  "Fix the failing CI build",
  "Explain this stack trace",
  "Write tests for utils/date.ts",
  "Search the docs for rate limits",
  "Refactor the auth middleware",
  "Summarize open pull requests",
];

export default function Demo({ v }: { v: V }) {
  const [picked, setPicked] = useState<string | null>(null);
  const list = ALL.slice(0, Number(v.count));
  return (
    <Suggestions
      suggestions={list}
      selectedSuggestion={v.selected === "On" ? (picked ?? list[0] ?? null) : null}
      cycle={0}
      onSuggestion={setPicked}
      variant={v.variant as "pills" | "list"}
    />
  );
}
