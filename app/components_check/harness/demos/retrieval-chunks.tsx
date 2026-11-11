"use client";
import { useEffect, useState } from "react";
import { RetrievalChunks, type RetrievalChunk } from "@harness/components/retrieval-chunks";
import type { V } from "../types";

const CHUNKS: RetrievalChunk[] = [
  { id: "1", source: "Auth runbook", locator: "§3.2", score: 0.92, text: "Rotate the signing key by publishing the new JWKS first, then switching the issuer after caches expire." },
  { id: "2", source: "Incident 2024-118", locator: "p. 4", score: 0.86, text: "Tokens failed validation for 14 minutes because the old key was removed before clients refreshed." },
  { id: "3", source: "Security policy", locator: "§7", score: 0.74, text: "Signing keys must rotate every 90 days and be kept for one overlap window." },
  { id: "4", source: "Gateway README", locator: "L120", score: 0.66, text: "The gateway caches JWKS responses for up to 10 minutes." },
  { id: "5", source: "Team wiki", locator: "auth/faq", score: 0.58, text: "Ask in #platform before rotating keys in production." },
];
const LONG = "how do we rotate the JWT signing key without logging users out across regions";

export default function Demo({ v }: { v: V }) {
  const chunks = CHUNKS.slice(0, Number(v.chunks));
  const stream = v.stream === "On";
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!stream) return;
    const t = setInterval(() => setN((k) => (k >= chunks.length + 4 ? 0 : k + 1)), 700);
    return () => clearInterval(t);
  }, [stream, chunks.length]);
  // streaming: two ticks of searching, then passages arrive one by one
  const searching = stream ? n < 2 : v.searching === "On";
  return (
    <RetrievalChunks
      query={v.query === "Long" ? LONG : "rotate JWT signing key"}
      chunks={chunks}
      visibleCount={stream ? n - 2 : searching ? 0 : chunks.length}
      searching={searching}
    />
  );
}
