"use client";
import { useEffect, useState } from "react";
import { StreamingText, type Segment } from "@harness/components/streaming-text";
import type { V } from "../types";

const SHORT: Segment[] = [{ text: "The failing test is in" }, { text: "auth.test.ts", mono: true }, { text: "and the fix is one line." }];
const LONG: Segment[] = [
  { text: "I traced the failing test to" },
  { text: "auth.test.ts", mono: true },
  { text: "where the token expiry is compared in seconds but stored in milliseconds. Changing" },
  { text: "Date.now()", mono: true },
  { text: "to divide by a thousand fixes it, and the other forty tests in the suite still pass." },
];

export default function Demo({ v }: { v: V }) {
  const base = v.length === "Long" ? LONG : SHORT;
  const segments = v.code === "On" ? base : base.map((s) => ({ text: s.text }));
  const total = segments.reduce((n, s) => n + s.text.split(" ").length, 0);
  const [n, setN] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setN((c) => c + 1), 120);
    return () => clearInterval(t);
  }, []);
  const streaming = v.streaming === "On";
  // Loop: stream the words in, hold the full text for 12 ticks, start over.
  const count = streaming ? n % (total + 12) : total;
  return <StreamingText segments={segments} count={count} streaming={streaming && count < total} />;
}
