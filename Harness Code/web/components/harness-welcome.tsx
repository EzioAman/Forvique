"use client";

import { SuggestionPrimitive, ThreadPrimitive, useAuiState } from "@assistant-ui/react";
import { EmptyState, EmptyStateGreeting, EmptyStateSuggestion, EmptyStateSuggestions } from "@/components/empty-state";
import { applied } from "@/lib/applied";

/* The new-chat view with the empty-state options accepted in the component check. Same greetings as its demo
   (app/components_check/harness/demos/empty-state.tsx). Suggestions are the runtime's (MyAssistant), sent on click;
   the composer is the thread's own, so the "Composer" option has nothing to switch here. */
const v = applied("empty-state");

const Pill = ({ index }: { index: number }) => (
  <SuggestionPrimitive.Trigger send render={<EmptyStateSuggestion index={index} />}>
    <SuggestionPrimitive.Title />
  </SuggestionPrimitive.Trigger>
);
const PILLS = Array.from({ length: 6 }, (_, i) => ({ Suggestion: () => <Pill index={i} /> }));

const HarnessWelcome = () => {
  // the accepted count can exceed the suggestions MyAssistant defines; SuggestionByIndex throws past the end
  const available = useAuiState((s) => s.suggestions.suggestions.length);
  const count = Math.min(Number(v?.count ?? 0), available);
  return (
    <EmptyState className="mx-auto mb-6">
      <EmptyStateGreeting>
        {v?.greeting === "Long" ? "Good evening. What should we build, fix or look up today?" : "What are we building?"}
      </EmptyStateGreeting>
      {count > 0 && (
        <EmptyStateSuggestions>
          {PILLS.slice(0, count).map((components, i) => (
            <ThreadPrimitive.SuggestionByIndex key={i} index={i} components={components} />
          ))}
        </EmptyStateSuggestions>
      )}
    </EmptyState>
  );
};

/** Undefined until empty-state is accepted, so the thread keeps its own welcome. */
export const Welcome = v ? HarnessWelcome : undefined;
