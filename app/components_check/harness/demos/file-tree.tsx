"use client";
import { useEffect, useState } from "react";
import { FileTree, type FileTreeNode } from "@harness/components/file-tree";
import type { V } from "../types";

const SMALL: FileTreeNode[] = [
  { path: "lib", name: "lib", depth: 0, kind: "folder" },
  { path: "lib/search.ts", name: "search.ts", depth: 1, kind: "file", additions: 12, deletions: 3 },
  { path: "lib/search.test.ts", name: "search.test.ts", depth: 1, kind: "file", additions: 28 },
];
const LARGE: FileTreeNode[] = [
  { path: "app", name: "app", depth: 0, kind: "folder" },
  { path: "app/page.tsx", name: "page.tsx", depth: 1, kind: "file", additions: 4, deletions: 1 },
  { path: "app/api", name: "api", depth: 1, kind: "folder" },
  { path: "app/api/route.ts", name: "route.ts", depth: 2, kind: "file", additions: 31, deletions: 9 },
  ...SMALL,
  { path: "package.json", name: "package.json", depth: 0, kind: "file", additions: 1, deletions: 1 },
];

export default function Demo({ v }: { v: V }) {
  const nodes = v.size === "Large" ? LARGE : SMALL;
  const stream = v.stream === "On";
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!stream) return;
    const t = setInterval(() => setN((k) => (k >= nodes.length + 3 ? 0 : k + 1)), 500);
    return () => clearInterval(t);
  }, [stream, nodes.length]);
  return (
    <FileTree
      nodes={nodes}
      visibleCount={stream ? n : nodes.length}
      totalAdditions={nodes.reduce((s, x) => s + (x.additions ?? 0), 0)}
      totalDeletions={nodes.reduce((s, x) => s + (x.deletions ?? 0), 0)}
    />
  );
}
