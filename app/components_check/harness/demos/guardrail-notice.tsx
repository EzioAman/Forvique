"use client";
import { GuardrailNotice } from "@harness/components/guardrail-notice";
import type { V } from "../types";

const ALTERNATIVES = [
  "Scan only hosts you own in the staging network",
  "Explain how port scanning works",
  "Write a firewall rule to block scans",
  "Summarize our pentest policy",
];
const SHORT = "Scanning third-party networks without permission isn't allowed.";
const LONG = "Scanning networks you don't own can break laws and the provider's terms. The agent stopped before running nmap against the external range. If you have written authorization, add the hosts to the allowlist and ask again.";

export default function Demo({ v }: { v: V }) {
  return (
    <GuardrailNotice
      title="Request blocked"
      policy="security/network"
      explanation={v.explanation === "Long" ? LONG : SHORT}
      alternatives={ALTERNATIVES.slice(0, Number(v.alternatives))}
      onPick={v.clickable === "On" ? () => {} : undefined}
    />
  );
}
