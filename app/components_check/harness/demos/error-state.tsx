"use client";
import { useEffect, useState } from "react";
import { ErrorState } from "@harness/components/error-state";
import type { V } from "../types";

const SHORT = "The model provider timed out.";
const LONG = "The model provider timed out after 60 seconds while streaming the reply. Your message was saved, so retrying will pick up where it stopped.";

export default function Demo({ v }: { v: V }) {
  // Retry shows the retrying state for a moment, then the error again
  const [retrying, setRetrying] = useState(false);
  useEffect(() => {
    if (!retrying) return;
    const t = setTimeout(() => setRetrying(false), 2000);
    return () => clearTimeout(t);
  }, [retrying]);
  return (
    <ErrorState
      title="Couldn't finish the response"
      detail={v.detail === "Long" ? LONG : SHORT}
      retrying={v.retrying === "On" || retrying}
      onRetry={() => setRetrying(true)}
    />
  );
}
