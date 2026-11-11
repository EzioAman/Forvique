"use client";
import { useState } from "react";
import { CheckpointHistory } from "@harness/components/checkpoint-history";
import type { V } from "../types";

const CHECKPOINTS = [
  { label: "Before any edits", at: "10:02", files: 0 },
  { label: "Added the search route", at: "10:06", files: 2 },
  { label: "Wired up the trigram index", at: "10:11", files: 4 },
  { label: "Fixed the failing tests", at: "10:15", files: 5 },
  { label: "Updated the docs", at: "10:18", files: 7 },
  { label: "Cleaned up imports", at: "10:20", files: 8 },
];

export default function Demo({ v }: { v: V }) {
  const checkpoints = CHECKPOINTS.slice(0, Number(v.checkpoints)).map((c, i) => ({ id: String(i), ...c }));
  const fromOption = String(v.current === "Earlier" ? Math.max(0, checkpoints.length - 3) : checkpoints.length - 1);
  // Restore moves "current" locally; changing an option resets it.
  const [restored, setRestored] = useState<{ key: string; id: string } | null>(null);
  const key = `${v.checkpoints}-${v.current}`;
  const currentId = restored && restored.key === key ? restored.id : fromOption;
  return (
    <CheckpointHistory
      checkpoints={checkpoints}
      currentId={currentId}
      onRestore={v.restore === "On" ? (id) => setRestored({ key, id }) : undefined}
    />
  );
}
