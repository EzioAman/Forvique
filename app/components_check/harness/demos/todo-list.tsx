"use client";
import { TodoList, type TodoItem, type TodoStatus } from "@harness/components/todo-list";
import type { V } from "../types";

const ITEMS = [
  { text: "Add a rate limiter to /api/search", description: "Token bucket, 10 requests per second per key." },
  { text: "Return 429 with a Retry-After header", description: "Clients back off using the header." },
  { text: "Write unit tests for the limiter", description: "Burst, refill and per-key isolation." },
  { text: "Load test with k6", description: "Confirm p95 stays under 200ms." },
  { text: "Document the limit in the API reference", description: "Add a Rate limits section." },
  { text: "Add a metric for rejected requests", description: "Counter tagged by route." },
  { text: "Alert when rejections spike", description: "Page if over 5% for 10 minutes." },
  { text: "Roll out behind a feature flag", description: "Start at 10% of traffic." },
];

// Status per row for each mix; rows past the list repeat the last status.
const MIX: Record<string, TodoStatus[]> = {
  "In progress": ["done", "done", "active", "pending"],
  "With failure": ["done", "failed", "cancelled", "active", "pending"],
  "All done": ["done"],
};

export default function Demo({ v }: { v: V }) {
  const mix = MIX[v.mix as string] ?? MIX["In progress"];
  const items: TodoItem[] = ITEMS.slice(0, Number(v.items)).map((item, i) => ({
    id: String(i),
    text: item.text,
    status: mix[Math.min(i, mix.length - 1)],
    description: v.itemDetails === "On" ? item.description : undefined,
    reason: "k6 is not installed in the sandbox.",
  }));
  return (
    <TodoList
      items={items}
      revision={v.revision === "On" ? 3 : undefined}
      description={v.description === "On" ? "Rate limiting for the public search API" : undefined}
      maxVisible={v.fold === "On" ? 3 : undefined}
    />
  );
}
