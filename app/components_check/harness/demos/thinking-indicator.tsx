"use client";
import { useEffect, useState } from "react";
import { ThinkingIndicator } from "@harness/components/thinking-indicator";
import type { V } from "../types";

const LONG = "Searching the web for recent tulip festival dates across the Netherlands and comparing ticket prices";

export default function Demo({ v }: { v: V }) {
  const [s, setS] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setS((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <ThinkingIndicator
      label={v.label === "Long" ? LONG : "Thinking"}
      elapsed={v.timer === "On" ? `${s}s` : undefined}
    />
  );
}
