"use client";
import { useEffect, useState } from "react";
import { ComputerUse, type ComputerStep } from "@harness/components/computer-use";
import type { V } from "../types";

const STEPS: ComputerStep[] = [
  { id: "1", action: "click", target: "Search field", x: 30, y: 20 },
  { id: "2", action: "type", target: "\"flights to Lisbon\"", x: 45, y: 22 },
  { id: "3", action: "click", target: "Search button", x: 78, y: 22 },
  { id: "4", action: "scroll", target: "Results list", x: 50, y: 60 },
  { id: "5", action: "click", target: "Cheapest fare, 09:40", x: 35, y: 72 },
  { id: "6", action: "click", target: "Continue to checkout", x: 70, y: 85 },
];

export default function Demo({ v }: { v: V }) {
  const steps = STEPS.slice(0, Number(v.steps));
  const [i, setI] = useState(0);
  useEffect(() => {
    if (v.autoplay !== "On") return;
    const t = setInterval(() => setI((k) => k + 1), 1400);
    return () => clearInterval(t);
  }, [v.autoplay]);
  return (
    <ComputerUse url="https://flights.example.com/search" steps={steps} activeIndex={i % steps.length}>
      <img src="https://picsum.photos/seed/browser/600/400" alt="" className="h-40 w-full object-cover" />
    </ComputerUse>
  );
}
