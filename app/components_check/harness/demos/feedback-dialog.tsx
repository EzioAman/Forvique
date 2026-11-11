"use client";
import { useState } from "react";
import { FeedbackDialog } from "@harness/components/feedback-dialog";
import type { V } from "../types";

const REASONS = ["Wrong answer", "Ran the wrong tool", "Too slow", "Ignored my files", "Unsafe change", "Other"];

export default function Demo({ v }: { v: V }) {
  const [selected, setSelected] = useState<string[]>(["Ran the wrong tool"]);
  const [note, setNote] = useState("");
  return (
    <FeedbackDialog
      reasons={REASONS.slice(0, Number(v.reasons))}
      selected={selected}
      note={note}
      sent={v.sent === "On"}
      onToggleReason={(r) => setSelected((s) => (s.includes(r) ? s.filter((x) => x !== r) : [...s, r]))}
      onNoteChange={setNote}
      onSubmit={v.submit === "On" ? () => {} : undefined}
    />
  );
}
