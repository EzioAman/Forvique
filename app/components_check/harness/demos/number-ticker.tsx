"use client";
import { useEffect, useState } from "react";
import { NumberTicker } from "@harness/components/number-ticker";
import type { V } from "../types";

const START = { Small: 128, Large: 1_284_920 } as Record<string, number>;
const LONG = "tokens processed across all subagents in this run";

export default function Demo({ v }: { v: V }) {
  const start = START[String(v.size)] ?? 128;
  const [value, setValue] = useState(start);
  useEffect(() => {
    setValue(start);
    if (v.animate !== "On") return;
    const t = setInterval(() => setValue((n) => n + Math.ceil(Math.random() * start * 0.05 + 1)), 1500);
    return () => clearInterval(t);
  }, [start, v.animate]);
  return <NumberTicker value={value} label={v.label === "Long" ? LONG : "tokens"} />;
}
