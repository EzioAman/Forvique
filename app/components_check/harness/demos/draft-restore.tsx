"use client";
import { DraftRestore } from "@harness/components/draft-restore";
import type { V } from "../types";

const SHORT = "Rename the config loader";
const LONG =
  "Rename the config loader to loadSettings, update every import in packages/web and packages/agent, and keep the old name working for one release";

export default function Demo({ v }: { v: V }) {
  return (
    <DraftRestore
      draft={v.draft === "Long" ? LONG : SHORT}
      savedAt="2 min ago"
      onRestore={() => {}}
      onDiscard={() => {}}
    />
  );
}
