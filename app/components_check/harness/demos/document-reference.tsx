"use client";
import { useState } from "react";
import { DocumentReference, type DocumentAnchor } from "@harness/components/document-reference";
import type { V } from "../types";

const ANCHORS: DocumentAnchor[] = [
  { page: 3, quote: "Median inference latency fell 38% after enabling speculative decoding." },
  { page: 7, quote: "Gains shrink for batch sizes above 32 as the draft model saturates." },
  { page: 12, quote: "We recommend a draft model one tenth the size of the target." },
  { page: 18, quote: "Memory overhead stays under 6% in every configuration tested." },
];

export default function Demo({ v }: { v: V }) {
  const [page, setPage] = useState(3);
  return (
    <DocumentReference
      title="Speculative decoding in production.pdf"
      pages={24}
      anchors={ANCHORS.slice(0, Number(v.anchors))}
      activePage={page}
      onJump={v.jump === "On" ? setPage : undefined}
    />
  );
}
