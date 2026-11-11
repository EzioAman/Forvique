"use client";

import { useState } from "react";
import { useAui, useAuiState } from "@assistant-ui/react";
import { ErrorState } from "@/components/error-state";
import { StoppedRun } from "@/components/stopped-run";

/* A run that fails before replying has no message to show its error on; retry restarts it from the last message. */
export function RunError({ message, onDone }: { message: string; onDone: () => void }) {
  const aui = useAui();
  const lastId = useAuiState((s) => s.thread.messages.at(-1)?.id ?? null);
  // a failure after some reply text already shows its error inside that reply; don't show a second one
  const hasReply = useAuiState((s) => s.thread.messages.at(-1)?.role === "assistant");
  const [retrying, setRetrying] = useState(false);
  if (hasReply) return null;
  return (
    <ErrorState
      title="The agent could not answer"
      detail={message}
      retrying={retrying}
      onRetry={() => {
        setRetrying(true);
        aui.thread().startRun({ parentId: lastId });
        onDone();
      }}
      className="mx-auto mt-3"
    />
  );
}

/* Shown under a reply the user stopped; continue starts a new run after it. */
export function StoppedRunNotice() {
  const aui = useAui();
  const id = useAuiState((s) => s.message.id);
  const stopped = useAuiState(
    (s) => s.message.status?.type === "incomplete" && s.message.status.reason === "cancelled",
  );
  const text = useAuiState((s) =>
    s.message.parts.map((p) => (p.type === "text" ? p.text : "")).join(" "),
  );
  if (!stopped) return null;
  return (
    <StoppedRun
      words={text.split(/\s+/).filter(Boolean).slice(-40)}
      reason="Stopped by you"
      onContinue={() => aui.thread().startRun({ parentId: id })}
      className="mt-2"
    />
  );
}
