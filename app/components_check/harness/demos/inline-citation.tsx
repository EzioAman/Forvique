"use client";
import { Citation, InlineCitation } from "@harness/components/inline-citation";
import type { V } from "../types";

const SOURCES = [
  { title: "Next.js 16 release notes", snippet: "Turbopack is now the default bundler for both dev and build.", url: "https://nextjs.org/blog/next-16", publishedAt: "2025-10-21" },
  { title: "Caching in the App Router", snippet: "Caching is opt-in through the use cache directive.", url: "https://nextjs.org/docs/app/guides/caching", publishedAt: "2025-10-22" },
  { title: "React 19.2", snippet: "Adds the Activity component and useEffectEvent.", url: "https://react.dev/blog/2025/10/01/react-19-2", publishedAt: "2025-10-01" },
  { title: "Upgrading to Next 16", snippet: "middleware.ts is renamed to proxy.ts.", url: "https://nextjs.org/docs/app/guides/upgrading/version-16", publishedAt: "2025-10-21" },
];
const CLAUSES = [
  "Next.js 16 makes Turbopack the default bundler",
  ", caching is now opt-in with a directive",
  ", it ships on React 19.2",
  ", and middleware is renamed to proxy",
];

export default function Demo({ v }: { v: V }) {
  return (
    <InlineCitation>
      {SOURCES.slice(0, Number(v.count)).map((s, i) => (
        <span key={s.url}>
          {CLAUSES[i]}
          <Citation
            index={i}
            source={{
              title: s.title,
              snippet: s.snippet,
              url: v.url === "On" ? s.url : undefined,
              domain: v.url === "On" ? undefined : new URL(s.url).hostname,
              publishedAt: v.date === "On" ? s.publishedAt : undefined,
            }}
          />
        </span>
      ))}
      .
    </InlineCitation>
  );
}
