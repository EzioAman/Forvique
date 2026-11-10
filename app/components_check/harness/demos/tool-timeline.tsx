"use client";
import { useEffect, useState } from "react";
import {
  FilePenIcon,
  FileSearchIcon,
  FileTextIcon,
  GitBranchIcon,
  GlobeIcon,
  SearchIcon,
  TerminalIcon,
  TestTubeIcon,
} from "lucide-react";
import { ToolTimeline } from "@harness/components/tool-timeline";
import type { V } from "../types";

const STEPS = [
  { id: "1", verb: "Searched", chip: "useAuiState", icon: SearchIcon },
  { id: "2", verb: "Read", chip: "components/thread.tsx", icon: FileTextIcon },
  { id: "3", verb: "Grepped", chip: "onOpenChange", icon: FileSearchIcon },
  { id: "4", verb: "Edited", chip: "components/tool-call.tsx", icon: FilePenIcon },
  { id: "5", verb: "Ran", chip: "pnpm test", icon: TestTubeIcon },
  { id: "6", verb: "Fetched", chip: "nextjs.org/docs", icon: GlobeIcon },
  { id: "7", verb: "Ran", chip: "pnpm tsc --noEmit", icon: TerminalIcon },
  { id: "8", verb: "Checked out", chip: "fix/tool-call", icon: GitBranchIcon },
];
const STATS = [
  { file: "tool-call.tsx", added: 12, removed: 4 },
  { file: "thread.tsx", added: 3 },
];

export default function Demo({ v }: { v: V }) {
  const count = Number(v.steps);
  const streaming = v.state === "Streaming";
  const [open, setOpen] = useState(v.open === "On");
  const [shown, setShown] = useState(count);
  useEffect(() => setOpen(v.open === "On"), [v.open]);
  useEffect(() => {
    setShown(streaming ? 1 : count);
    if (!streaming) return;
    const t = setInterval(() => setShown((n) => (n >= count ? 1 : n + 1)), 1200);
    return () => clearInterval(t);
  }, [count, streaming]);
  return (
    <ToolTimeline
      steps={STEPS.slice(0, count)}
      visibleSteps={shown}
      streaming={streaming}
      open={open}
      onOpenChange={setOpen}
      activeLabel={`Working · ${shown} steps`}
      restingLabel={`Used ${count} tools`}
      stats={v.stats === "On" ? STATS : []}
    />
  );
}
