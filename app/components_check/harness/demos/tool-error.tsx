"use client";
import { ToolError } from "@harness/components/tool-error";
import type { V } from "../types";

const LONG =
  "FetchError: request to https://api.github.com/repos/vercel/next.js/issues?state=open&per_page=100 failed, reason: connect ETIMEDOUT 140.82.112.6:443 after 30000ms";

export default function Demo({ v }: { v: V }) {
  return (
    <ToolError
      name="fetch_url"
      target="api.github.com/repos/vercel/next.js/issues"
      message={v.message === "Long" ? LONG : "ETIMEDOUT after 30s"}
      attempt={Math.min(Number(v.attempt), Number(v.max))}
      maxAttempts={Number(v.max)}
      retrying={v.retrying === "On"}
      onRetry={() => {}}
      onSkip={v.skip === "On" ? () => {} : undefined}
    />
  );
}
