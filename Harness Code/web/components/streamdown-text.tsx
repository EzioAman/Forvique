"use client";

import { useMemo, type ComponentProps, type ReactNode } from "react";
import { useAuiState } from "@assistant-ui/react";
import {
  StreamdownTextPrimitive,
  escapeCurrencyDollars,
  normalizeMathDelimiters,
} from "@assistant-ui/react-streamdown";
import { code } from "@streamdown/code";
import { math } from "@streamdown/math";
import "katex/dist/katex.min.css";
import { Citation } from "@/components/inline-citation";
import { MermaidDiagram } from "@/components/mermaid-diagram";

/* ```mermaid fences render as diagrams; the skeleton shows until the reply finishes, since a half-written diagram fails to parse */
const Mermaid = ({ code }: { code: string }) => {
  const streaming = useAuiState((s) => s.message.status?.type === "running");
  return <MermaidDiagram code={code} streaming={streaming} />;
};
const byLanguage = { mermaid: { SyntaxHighlighter: Mermaid } };

/* Assistant text: Shiki code blocks with copy buttons, KaTeX math, tables. Models often write \( \) and
   \[ \] math, and prices like "$5 to $10" must not turn into a formula. */
const preprocess = (text: string) => escapeCurrencyDollars(normalizeMathDelimiters(text));

type Hit = { title: string; snippet: string; link: string };
const hostOf = (url: string) => {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
};
const textOf = (node: ReactNode): string =>
  typeof node === "string" || typeof node === "number"
    ? String(node)
    : Array.isArray(node)
      ? node.map(textOf).join("")
      : "";

/* Web links in a reply become numbered citations; the snippet comes from this message's web_search results. */
export const StreamdownText = () => {
  // select the parts as stored (a stable reference) and derive from them: a selector that builds a new
  // array on every read makes React re-render forever
  const parts = useAuiState((s) => s.message.parts);
  const hits = useMemo(
    () =>
      parts.flatMap((p) => {
        if (p.type !== "tool-call" || p.toolName !== "web_search" || p.result === undefined)
          return [];
        try {
          const r = typeof p.result === "string" ? JSON.parse(p.result) : p.result;
          return Array.isArray(r) ? (r as Hit[]) : [];
        } catch {
          return [];
        }
      }),
    [parts],
  );
  const a = (props: Record<string, unknown>) => {
    const { href, children, ...rest } = props as ComponentProps<"a">;
    if (!href || !/^https?:\/\//.test(href))
      return (
        <a href={href} {...rest}>
          {children}
        </a>
      );
    // index = the source's row in the search card (one result per domain), zero-based: Citation shows index + 1
    const hit = hits.find((h) => h.link === href);
    const domains = [...new Set(hits.map((h) => hostOf(h.link)))];
    const row = domains.indexOf(hostOf(href));
    const index = row >= 0 ? row : domains.length;
    return (
      <>
        {children}{" "}
        <Citation
          index={index}
          source={{ title: hit?.title ?? textOf(children), snippet: hit?.snippet ?? "", url: href }}
        />
      </>
    );
  };
  return (
    <StreamdownTextPrimitive
      plugins={{ code, math }}
      preprocess={preprocess}
      shikiTheme={["github-light", "github-dark"]}
      // Streamdown types `components` two incompatible ways; the anchor props are what it passes at runtime
      components={{ a: a as never }}
      componentsByLanguage={byLanguage}
    />
  );
};
