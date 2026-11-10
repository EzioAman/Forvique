"use client";
import { useState } from "react";
import { MessageBranches } from "@harness/components/message-branches";
import type { V } from "../types";

const VARIANTS = [
  "The build fails because the lockfile pins esbuild 0.19 while vite 6 needs 0.24. Updating the lockfile fixes it.",
  "Your CI cache is stale. Clear the pnpm store cache key and rerun; the esbuild binary mismatch goes away.",
  "Pin vite to 5.4 for now. The upgrade to 6 changes the esbuild peer range, which is what breaks the build.",
  "Run pnpm install --frozen-lockfile=false once, commit the new lockfile, and the esbuild error clears.",
  "The postinstall step for esbuild is skipped in CI. Allow it in pnpm-workspace.yaml under onlyBuiltDependencies.",
];

export default function Demo({ v }: { v: V }) {
  const [index, setIndex] = useState(0);
  const variants = VARIANTS.slice(0, Number(v.count));
  return <MessageBranches variants={variants} index={Math.min(index, variants.length - 1)} onIndexChange={setIndex} />;
}
