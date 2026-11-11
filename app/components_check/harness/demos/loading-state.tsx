"use client";
import { useEffect, useState } from "react";
import { GenerationLoader, type GenerationLoaderVariant } from "@harness/components/loading-state";
import type { V } from "../types";

const LONG = "Generating a dependency graph for the monorepo and checking each package for circular imports";

export default function Demo({ v }: { v: V }) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 100);
    return () => clearInterval(t);
  }, []);
  return (
    <GenerationLoader
      label={v.label === "Long" ? LONG : "Generating"}
      tick={tick}
      variant={v.variant as GenerationLoaderVariant}
    />
  );
}
