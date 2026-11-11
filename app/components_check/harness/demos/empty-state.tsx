"use client";
import {
  EmptyState,
  EmptyStateComposer,
  EmptyStateGreeting,
  EmptyStateSuggestion,
  EmptyStateSuggestions,
} from "@harness/components/empty-state";
import type { V } from "../types";

const SUGGESTIONS = [
  "Fix the failing build",
  "Review my last commit",
  "Search the docs",
  "Write a migration",
  "Explain this repo",
  "Plan a refactor",
];

export default function Demo({ v }: { v: V }) {
  const count = Number(v.count);
  return (
    <EmptyState>
      <EmptyStateGreeting>
        {v.greeting === "Long" ? "Good evening. What should we build, fix or look up today?" : "What are we building?"}
      </EmptyStateGreeting>
      {count > 0 && (
        <EmptyStateSuggestions>
          {SUGGESTIONS.slice(0, count).map((s, i) => (
            <EmptyStateSuggestion key={s} index={i}>
              {s}
            </EmptyStateSuggestion>
          ))}
        </EmptyStateSuggestions>
      )}
      {v.composer === "On" && <EmptyStateComposer placeholder="Ask the agent anything" onSend={() => {}} />}
    </EmptyState>
  );
}
