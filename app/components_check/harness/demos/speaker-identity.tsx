"use client";
import { SpeakerIdentity, type SpeakerTurn } from "@harness/components/speaker-identity";
import type { V } from "../types";

const TURNS: (SpeakerTurn & { long: string })[] = [
  { id: "1", kind: "user", name: "You", detail: "10:42", text: "Why is the build failing?", long: "Why is the build failing on main since this morning? It passed locally for me." },
  { id: "2", kind: "agent", name: "Harness", detail: "Opus", text: "Checking the CI logs now.", long: "Checking the CI logs now. I'll send a subagent to bisect the last five commits while I read the failure." },
  { id: "3", kind: "subagent", name: "Bisector", detail: "subagent", text: "Commit a3f26ed breaks the type-check.", long: "Commit a3f26ed breaks the type-check: a prop was renamed in one file but not in its two callers." },
  { id: "4", kind: "tool", name: "run_tests", detail: "tool", text: "2 failed, 41 passed", long: "2 failed, 41 passed in 12.4s. Failures: thread.test.tsx, composer.test.tsx." },
];

export default function Demo({ v }: { v: V }) {
  const turns = TURNS.slice(0, Number(v.turns)).map(({ long, ...t }) => ({
    ...t,
    text: v.text === "Long" ? long : t.text,
    detail: v.details === "On" ? t.detail : undefined,
  }));
  return <SpeakerIdentity turns={turns} />;
}
