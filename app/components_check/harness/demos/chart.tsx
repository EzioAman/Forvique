"use client";
import { useEffect, useState } from "react";
import { Chart, type ChartVariant } from "@harness/components/chart";
import type { V } from "../types";

const POINTS = [212, 198, 240, 231, 260, 255, 290, 284, 310, 342, 330, 365, 380, 372, 401, 420, 415, 446, 470, 462, 495, 510, 530, 548];
const DELTA: Record<string, string | undefined> = { Up: "+12.4%", Down: "−8.1%", Flat: "0.0%", None: undefined };

export default function Demo({ v }: { v: V }) {
  const points = POINTS.slice(0, Number(v.points));
  const [shown, setShown] = useState(points.length);
  useEffect(() => {
    setShown(points.length);
    if (v.stream !== "On") return;
    setShown(1);
    const t = setInterval(() => setShown((n) => (n >= points.length ? 1 : n + 1)), 400);
    return () => clearInterval(t);
  }, [points.length, v.stream]);
  return (
    <Chart
      label="Agent runs / day"
      value={points[Math.min(shown, points.length) - 1]!.toLocaleString("en-US")}
      delta={DELTA[String(v.delta)]}
      points={points}
      visibleCount={shown}
      variant={v.variant as ChartVariant}
      upIsGood={v.upIsGood === "On"}
    />
  );
}
