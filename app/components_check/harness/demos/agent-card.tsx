"use client";
import { useState } from "react";
import { AgentCard } from "@harness/components/agent-card";
import type { V } from "../types";

const SKILLS = [
  { name: "review", description: "Reviews pull requests for bugs and style." },
  { name: "triage", description: "Labels and routes new issues." },
  { name: "release", description: "Drafts release notes from merged PRs." },
  { name: "deps", description: "Opens upgrade PRs for outdated packages." },
];

const LONG =
  "Watches the repository, reviews every pull request against the team's conventions, triages new issues by area and severity, and drafts release notes when a version is tagged.";

export default function Demo({ v }: { v: V }) {
  // Connect flips local state; changing the option resets it.
  const [connected, setConnected] = useState<{ from: string | number; on: boolean } | null>(null);
  const on = connected && connected.from === v.connected ? connected.on : v.connected === "On";
  return (
    <AgentCard
      name="Repo Steward"
      description={v.description === "Long" ? LONG : "Reviews PRs and triages issues."}
      provider="Acme Tools"
      version="1.4.0"
      model="sonnet"
      endpoint="https://agents.acme.dev/steward"
      skills={SKILLS.slice(0, Number(v.skills))}
      connected={on}
      onConnect={() => setConnected({ from: v.connected, on: true })}
    />
  );
}
