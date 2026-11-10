"use client";
import { MessageQueue, type QueuedMessage } from "@harness/components/message-queue";
import type { V } from "../types";

const QUEUE: QueuedMessage[] = [
  { id: "1", text: "Then add a test for the empty case" },
  { id: "2", text: "Also bump the package version" },
  { id: "3", text: "Write a short changelog entry" },
  { id: "4", text: "Open a draft PR when done" },
  { id: "5", text: "Ping me with the preview link" },
];
const SHORT = "Fixing the date parser";
const LONG = "Fixing the date parser so ISO strings with offsets round-trip through the API and the cache";

export default function Demo({ v }: { v: V }) {
  return (
    <MessageQueue
      running={v.running === "Long" ? LONG : SHORT}
      queued={QUEUE.slice(0, Number(v.queued))}
      onCancel={v.cancel === "On" ? () => {} : undefined}
    />
  );
}
