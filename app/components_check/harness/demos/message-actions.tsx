"use client";
import { MessageActions, type Reaction } from "@harness/components/message-actions";
import type { V } from "../types";

const REACTION: Record<string, Reaction> = { None: null, Up: "up", Down: "down" };

export default function Demo({ v }: { v: V }) {
  return (
    <MessageActions
      copied={v.copied === "On"}
      reaction={REACTION[v.reaction] ?? null}
      regenerating={v.regenerating === "On"}
      onCopy={() => {}}
      onReactionChange={() => {}}
      onRegenerate={() => {}}
      onMore={() => {}}
    />
  );
}
