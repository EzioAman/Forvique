"use client";
import { DataTable, type DataTableColumn } from "@harness/components/data-table";
import type { V } from "../types";

const DAY = 86_400_000;
const NOW = Date.UTC(2026, 10, 10);
const ROWS = [
  { name: "vercel/next.js", stars: 131000, change: 2.4, license: "MIT", updated: NOW - 0.2 * DAY },
  { name: "facebook/react", stars: 236000, change: 0.8, license: "MIT", updated: NOW - 1 * DAY },
  { name: "assistant-ui/assistant-ui", stars: 7800, change: 12.1, license: "MIT", updated: NOW - 3 * DAY },
  { name: "langchain-ai/langgraph", stars: 18400, change: 5.6, license: "MIT", updated: NOW - 6 * DAY },
  { name: "microsoft/TypeScript", stars: 104000, change: -0.3, license: "Apache-2.0", updated: NOW - 9 * DAY },
  { name: "denoland/deno", stars: 101000, change: -1.2, license: "MIT", updated: NOW - 20 * DAY },
  { name: "oven-sh/bun", stars: 78000, change: 3.3, license: "MIT", updated: NOW - 32 * DAY },
  { name: "elastic/elasticsearch", stars: 73000, change: 0, license: "SSPL", updated: NOW - 60 * DAY },
].map((r) => ({ ...r, updated: new Date(r.updated).toISOString() }));

export default function Demo({ v }: { v: V }) {
  const columns: DataTableColumn[] = [
    { key: "name", label: "Repository", priority: "primary" },
    { key: "stars", label: "Stars", format: { kind: "number", compact: true } },
    { key: "change", label: "7d", format: { kind: "delta", decimals: 1, unit: "%" } },
    { key: "license", label: "License", format: { kind: "badge", tones: { MIT: "success", "Apache-2.0": "neutral", SSPL: "warning" } } },
    { key: "updated", label: "Updated", format: { kind: "date", style: v.date as "date" | "datetime" | "relative" } },
  ];
  const sort = v.sort === "None" ? undefined : { key: "stars", direction: v.sort === "Asc" ? ("asc" as const) : ("desc" as const) };
  return (
    <DataTable
      key={String(v.sort)}
      columns={columns}
      rows={ROWS.slice(0, Number(v.rows))}
      rowKey="name"
      caption={v.caption === "On" ? "Trending repositories this week" : undefined}
      defaultSort={sort}
      relativeTo={NOW}
      emptyMessage="No repositories matched"
    />
  );
}
