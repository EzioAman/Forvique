"use client";
import { useEffect, useState } from "react";
import { CodeDiff, type DiffLine } from "@harness/components/code-diff";
import type { V } from "../types";

const SHORT: DiffLine[] = [
  { kind: "context", text: "export async function search(query: string) {" },
  { kind: "removed", text: "  const res = await fetch(`/api?q=${query}`);" },
  { kind: "added", text: "  const res = await fetch(`/api?q=${encodeURIComponent(query)}`);" },
  { kind: "context", text: "  return res.json();" },
  { kind: "context", text: "}" },
];
const LONG: DiffLine[] = [
  ...SHORT.slice(0, 3),
  { kind: "added", text: "  if (!res.ok) throw new Error(`search failed: ${res.status}`);" },
  { kind: "removed", text: "  return res.json();" },
  { kind: "added", text: "  const data = await res.json();" },
  { kind: "added", text: "  return data.results.slice(0, 10);" },
  { kind: "context", text: "}" },
];

export default function Demo({ v }: { v: V }) {
  const [cycle, setCycle] = useState(0);
  useEffect(() => {
    if (v.replay !== "On") return;
    const t = setInterval(() => setCycle((n) => n + 1), 4000);
    return () => clearInterval(t);
  }, [v.replay]);
  const lines = v.length === "Long" ? LONG : SHORT;
  return (
    <CodeDiff
      filename="lib/search.ts"
      additions={lines.filter((l) => l.kind === "added").length}
      deletions={lines.filter((l) => l.kind === "removed").length}
      lines={lines}
      cycle={cycle}
    />
  );
}
