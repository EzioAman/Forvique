"use client";
import { useEffect, useState } from "react";
import { WebSearch } from "@harness/components/web-search";
import type { V } from "../types";

const RESULTS = [
  { title: "Next.js 16 release notes", domain: "nextjs.org" },
  { title: "Caching and revalidating in the App Router", domain: "vercel.com" },
  { title: "Migrating route handlers to Next 16", domain: "github.com" },
  { title: "What changed in React 19.2", domain: "react.dev" },
  { title: "Next 16 upgrade notes from a large codebase", domain: "dev.to" },
];
const LONG = "next.js 16 app router breaking changes for route handlers, caching and middleware";

export default function Demo({ v }: { v: V }) {
  const count = Number(v.results);
  const searching = v.state === "Searching";
  const [shown, setShown] = useState(count);
  const [cycle, setCycle] = useState(0);
  useEffect(() => {
    setShown(searching ? 0 : count);
    if (!searching) return;
    let n = 0;
    const t = setInterval(() => {
      n = n < count ? n + 1 : 0;
      if (n === 0) setCycle((c) => c + 1);
      setShown(n);
    }, 700);
    return () => clearInterval(t);
  }, [count, searching]);
  return (
    <WebSearch
      query={v.query === "Long" ? LONG : "next.js 16 caching"}
      results={RESULTS.slice(0, count)}
      visibleResults={shown}
      searching={searching}
      cycle={cycle}
    />
  );
}
