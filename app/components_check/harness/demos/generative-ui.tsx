"use client";
import { renderGenerativeUI } from "@assistant-ui/generative-ui/react";
import { styledGenerativeUILibrary } from "@harness/components/generative-ui";
import type { V } from "../types";

// Sample `present` trees, the `{ _type, ...props, children }` form the model emits.
const TREES: Record<string, unknown> = {
  Card: {
    _type: "Card",
    title: "Pull request #4182",
    children: [
      { _type: "Text", value: "Fix ToolCall reading open state before mount" },
      {
        _type: "Row",
        gap: 4,
        children: [
          { _type: "Fact", label: "Files", value: 3 },
          { _type: "Fact", label: "Tests", value: "42 passed", delta: "+2", trend: "up" },
          { _type: "Badge", value: "Ready" },
        ],
      },
    ],
  },
  Steps: {
    _type: "Col",
    gap: 3,
    children: [
      { _type: "Header", text: "Upgrade to Next 16", size: "md" },
      {
        _type: "Steps",
        steps: [
          { title: "Bump next and react", detail: "pnpm add next@16 react@19.2" },
          { title: "Rename middleware.ts", detail: "It is proxy.ts now" },
          { title: "Run the type check", detail: "pnpm tsc --noEmit" },
        ],
      },
    ],
  },
  Alert: {
    _type: "Alert",
    tone: "warning",
    title: "Rate limit close",
    description: "The GitHub token has 12 requests left this hour. Searches will pause at 0.",
  },
  Markdown: {
    _type: "Markdown",
    value: "**Found 3 call sites** of `useAuiState`:\n\n- `thread.tsx`\n- `tool-group.tsx`\n- `composer.tsx`",
  },
  Diagram: {
    _type: "Diagram",
    title: "Agent loop",
    code: "graph LR\n  Plan --> Act\n  Act --> Observe\n  Observe --> Plan",
  },
  Map: {
    _type: "Map",
    route: true,
    places: [
      { label: "Amsterdam Centraal", lat: 52.3791, lng: 4.9003, detail: "Start" },
      { label: "Keukenhof", lat: 52.2697, lng: 4.5466, detail: "Tulip gardens" },
      { label: "Haarlem", lat: 52.3874, lng: 4.6462, detail: "Lunch" },
    ],
  },
};

export default function Demo({ v }: { v: V }) {
  return (
    <div data-aui="root" className="w-full max-w-md">
      {renderGenerativeUI(TREES[String(v.tree)], styledGenerativeUILibrary, {
        status: v.status === "Streaming" ? "streaming" : "done",
      })}
    </div>
  );
}
