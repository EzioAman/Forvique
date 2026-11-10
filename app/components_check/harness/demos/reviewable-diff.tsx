"use client";
import { useState } from "react";
import { ReviewableDiff, type DiffHunk, type HunkDecision } from "@harness/components/reviewable-diff";
import type { V } from "../types";

const HUNKS: DiffHunk[] = [
  {
    id: "a", range: "@@ -12,3 +12,4 @@", decision: "pending",
    lines: [{ kind: "context", text: "const client = createClient();" }, { kind: "added", text: "client.setTimeout(30_000);" }],
  },
  {
    id: "b", range: "@@ -40,4 +41,4 @@", decision: "pending",
    lines: [{ kind: "removed", text: "  retries: 1," }, { kind: "added", text: "  retries: 3," }],
  },
  {
    id: "c", range: "@@ -77,2 +78,3 @@", decision: "pending",
    lines: [{ kind: "context", text: "export default client;" }, { kind: "added", text: "export { client as apiClient };" }],
  },
  {
    id: "d", range: "@@ -90,3 +92,2 @@", decision: "pending",
    lines: [{ kind: "removed", text: "// TODO: remove legacy fallback" }, { kind: "context", text: "}" }],
  },
];

export default function Demo({ v }: { v: V }) {
  const [decided, setDecided] = useState<Record<string, HunkDecision>>({});
  const set = (d: HunkDecision) => (id: string) => setDecided((m) => ({ ...m, [id]: d }));
  const hunks = HUNKS.slice(0, Number(v.hunks)).map((h) => ({ ...h, decision: decided[h.id] ?? h.decision }));
  const actions = v.actions === "On";
  return (
    <ReviewableDiff
      filename="src/api/client.ts"
      hunks={hunks}
      onKeep={actions ? set("kept") : undefined}
      onDiscard={actions ? set("discarded") : undefined}
      onApply={v.apply === "On" ? () => setDecided({}) : undefined}
    />
  );
}
