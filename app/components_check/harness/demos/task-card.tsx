"use client";
import { useEffect, useState } from "react";
import { TaskCard, type TaskCardState } from "@harness/components/task-card";
import { Button } from "@harness/components/ui/button";
import type { V } from "../types";

const LONG = "Migrate every API route from the pages router to route handlers and update the tests";

export default function Demo({ v }: { v: V }) {
  const [s, setS] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setS((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);
  const state = v.state as TaskCardState;
  return (
    <TaskCard
      label={v.label === "Long" ? LONG : "Upgrade eslint config"}
      meta={v.meta === "On" ? "sonnet" : undefined}
      state={state}
      elapsed={v.timer === "On" ? (state === "working" ? `${s}s` : "1m 12s") : undefined}
      actions={
        v.actions === "On" ? (
          <div className="flex gap-2">
            <Button size="sm">Approve</Button>
            <Button size="sm" variant="outline">Deny</Button>
          </div>
        ) : undefined
      }
      result={v.result === "On" ? "Moved to the flat config. 3 rules renamed, no new warnings." : undefined}
    >
      {v.transcript === "On"
        ? ["Read .eslintrc.json", "Wrote eslint.config.mjs", "Ran pnpm lint (0 errors)"].map((line) => (
            <p key={line} className="text-xs">{line}</p>
          ))
        : null}
    </TaskCard>
  );
}
