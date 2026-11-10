"use client";
import { QuoteReply, type QuoteAction } from "@harness/components/quote-reply";
import type { V } from "../types";

const ACTIONS: QuoteAction[] = [
  { key: "quote", label: "Quote", icon: "quote" },
  { key: "explain", label: "Explain", icon: "explain" },
  { key: "rewrite", label: "Rewrite", icon: "rewrite" },
];
const SHORT = "a stale cache key";
const LONG = "the cache key leaves out the locale, so a German page can be served to an English visitor";

export default function Demo({ v }: { v: V }) {
  const selection = v.selection === "Long" ? LONG : SHORT;
  return (
    <QuoteReply
      before="The flaky test fails because "
      selection={selection}
      after=" is reused between runs. Clearing it in beforeEach fixes the race."
      actions={ACTIONS}
      toolbarVisible={v.toolbar === "On"}
      quoted={v.quoted === "On" ? selection : undefined}
      onAction={() => {}}
    />
  );
}
