"use client";
import { FileDownload, FileIconDisplay, FileName, FileRoot, FileSize } from "@harness/components/file";
import type { V } from "../types";

const TYPES: Record<string, [mime: string, short: string, long: string]> = {
  PDF: ["application/pdf", "report.pdf", "q3-infrastructure-cost-review-final-v2.pdf"],
  Image: ["image/png", "screenshot.png", "failing-checkout-page-safari-ios-17.png"],
  JSON: ["application/json", "results.json", "benchmark-results-all-models-2026-11.json"],
  Text: ["text/plain", "notes.txt", "agent-run-log-session-4f2a-full-output.txt"],
  Audio: ["audio/mpeg", "standup.mp3", "weekly-standup-recording-platform-team.mp3"],
  Other: ["application/zip", "build.zip", "production-build-artifacts-with-sourcemaps.zip"],
};
const DATA = "data:application/octet-stream;base64,SGFybmVzcyBzYW1wbGUgZmlsZQ==";

type Variant = "outline" | "ghost" | "muted";
type Size = "sm" | "default" | "lg";

export default function Demo({ v }: { v: V }) {
  const [mime, short, long] = TYPES[v.type] ?? TYPES.PDF;
  const name = v.name === "Long" ? long : short;
  return (
    <FileRoot variant={v.variant as Variant} size={v.size as Size} className="max-w-sm">
      <FileIconDisplay mimeType={mime} />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <FileName>{name}</FileName>
        {v.showSize === "On" && <FileSize bytes={248_320} className="text-xs" />}
      </div>
      {v.download === "On" && <FileDownload data={DATA} mimeType={mime} filename={name} />}
    </FileRoot>
  );
}
