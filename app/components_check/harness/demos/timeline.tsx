"use client";
import { useEffect, useState } from "react";
import { Timeline, type TimelineWhen } from "@harness/components/timeline";
import type { V } from "../types";

const EVENTS = [
  { time: "09:02", title: "Run started", detail: "Triggered by a push to feature/search." },
  { time: "09:03", title: "Indexed the repo", detail: "4,812 files, 312k lines." },
  { time: "09:05", title: "Found 3 call sites", detail: "searchDocs is used in api, worker and cli." },
  { time: "09:07", title: "Editing api/search.ts", detail: "Switching to the trigram index." },
  { time: "09:10", title: "Run the benchmark", detail: "Compare p95 before and after." },
  { time: "09:12", title: "Open a pull request", detail: "Request review from the search team." },
];

export default function Demo({ v }: { v: V }) {
  const total = Number(v.events);
  const now = Math.floor((total - 1) / 2); // middle event is "now", earlier are past, later are future
  const events = EVENTS.slice(0, total).map((e, i) => ({
    id: String(i),
    when: (i < now ? "past" : i === now ? "now" : "future") as TimelineWhen,
    time: e.time,
    title: e.title,
    detail: v.details === "On" ? e.detail : undefined,
  }));
  const [n, setN] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setN((c) => c + 1), 700);
    return () => clearInterval(t);
  }, []);
  // Reveal one event per tick, hold the full list for 3 ticks, start over.
  const visibleCount = v.reveal === "On" ? Math.min(total, (n % (total + 3)) + 1) : total;
  return <Timeline events={events} visibleCount={visibleCount} />;
}
