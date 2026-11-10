"use client";
import { MermaidDiagram } from "@harness/components/mermaid-diagram";
import type { V } from "../types";

const DIAGRAMS: Record<string, string> = {
  Flowchart: `graph TD
  U[User message] --> P[Planner]
  P --> S[Web search]
  P --> C[Code tool]
  S --> A[Answer]
  C --> A`,
  Sequence: `sequenceDiagram
  User->>Agent: Fix the failing test
  Agent->>Shell: pnpm test
  Shell-->>Agent: 1 failed
  Agent->>Editor: Patch tool-call.tsx
  Agent-->>User: Fixed, all tests pass`,
  State: `stateDiagram-v2
  [*] --> Idle
  Idle --> Running: submit
  Running --> Waiting: tool call
  Waiting --> Running: result
  Running --> Done: reply
  Done --> [*]`,
};

export default function Demo({ v }: { v: V }) {
  return (
    <div className="w-full max-w-lg">
      <MermaidDiagram code={DIAGRAMS[String(v.diagram)] ?? DIAGRAMS.Flowchart!} streaming={v.streaming === "On"} />
    </div>
  );
}
