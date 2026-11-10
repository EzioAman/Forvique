"use client";
import { DaySeparator, type DatedMessage } from "@harness/components/day-separator";
import type { V } from "../types";

const DAYS = ["Monday", "Yesterday", "Today"];
const LINES: [DatedMessage["role"], string][] = [
  ["user", "Can you check why the deploy failed?"],
  ["assistant", "The build step ran out of memory. I raised the Node heap limit."],
  ["user", "Did the preview come up?"],
  ["assistant", "Yes, the preview is live and all checks pass."],
];

export default function Demo({ v }: { v: V }) {
  const days = DAYS.slice(-Number(v.days));
  const messages: DatedMessage[] = days.flatMap((day, d) =>
    LINES.slice(0, Number(v.perDay)).map(([role, text], i) => ({
      id: `${d}-${i}`,
      day,
      time: `${9 + d}:${String(i * 7).padStart(2, "0")}`,
      role,
      text,
    })),
  );
  return <DaySeparator messages={messages} />;
}
