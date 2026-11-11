"use client";
import { TypingIndicator } from "@harness/components/typing-indicator";
import type { V } from "../types";

export default function Demo({ v }: { v: V }) {
  return <TypingIndicator variant={v.variant === "bare" ? "bare" : "bubble"} />;
}
