"use client";
import { useEffect, useState } from "react";
import { ReasoningContent, ReasoningRoot, ReasoningText, ReasoningTrigger } from "@harness/components/reasoning";
import type { V } from "../types";

const TEXT = [
  "The user wants the search endpoint to return results faster. The slow part is the full-table scan on documents.title.",
  "A trigram index would let the LIKE query use the index. That needs the pg_trgm extension, which is already enabled in the migrations.",
  "I should add the index in a new migration, then re-run the benchmark to compare p95 latency before and after.",
];

export default function Demo({ v }: { v: V }) {
  const streaming = v.streaming === "On";
  const [n, setN] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setN((c) => c + 1), 900);
    return () => clearInterval(t);
  }, []);
  const shown = streaming ? TEXT.slice(0, (n % TEXT.length) + 1) : TEXT;
  return (
    // defaultOpen is read once, so remount when it changes.
    <ReasoningRoot
      key={String(v.defaultOpen)}
      variant={v.variant as "outline" | "ghost" | "muted"}
      defaultOpen={v.defaultOpen === "On"}
      streaming={streaming}
    >
      <ReasoningTrigger active={streaming} duration={v.duration === "On" && !streaming ? 8 : undefined} />
      <ReasoningContent>
        <ReasoningText>
          {shown.map((p) => (
            <p key={p}>{p}</p>
          ))}
        </ReasoningText>
      </ReasoningContent>
    </ReasoningRoot>
  );
}
