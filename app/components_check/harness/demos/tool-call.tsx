"use client";
import { useEffect, useState } from "react";
import { ToolCall } from "@harness/components/tool-call";
import type { V } from "../types";

const LONG_QUERY = "next.js 16 app router breaking changes for route handlers and caching";

export default function Demo({ v }: { v: V }) {
  const [open, setOpen] = useState(v.open === "On");
  useEffect(() => setOpen(v.open === "On"), [v.open]);
  const query = v.query === "Long" ? LONG_QUERY : "next.js 16 caching";
  return (
    <ToolCall
      label="Searched"
      activeLabel="Searching"
      query={query}
      request={`web_search({ query: "${query}", max_results: 5 })`}
      result="5 results: nextjs.org/blog/next-16, nextjs.org/docs/app/guides/caching, github.com/vercel/next.js/discussions, …"
      running={v.state === "Running"}
      open={open}
      onOpenChange={setOpen}
    />
  );
}
