"use client";
import { useEffect, useState } from "react";
import { ElicitationForm, type ElicitationField, type ElicitationState } from "@harness/components/elicitation-form";
import type { V } from "../types";

const FIELDS: ElicitationField[] = [
  { name: "repo", label: "Repository", value: "vercel/next.js", kind: "text", required: true },
  { name: "branch", label: "Base branch", value: "main", kind: "choice", options: ["main", "canary", "release"] },
  { name: "draft", label: "Open as draft", value: "true", kind: "toggle" },
];

export default function Demo({ v }: { v: V }) {
  const [state, setState] = useState(v.state as ElicitationState);
  const [values, setValues] = useState<Record<string, string>>({});
  useEffect(() => setState(v.state as ElicitationState), [v.state]);
  const fields = FIELDS.slice(0, Number(v.fields)).map((f) => ({
    ...f,
    value: values[f.name] ?? f.value,
    required: v.required === "On" ? f.kind !== "toggle" : false,
  }));
  return (
    <ElicitationForm
      server="github-mcp"
      message="The GitHub server needs a few details before it opens the pull request."
      fields={fields}
      state={state}
      onFieldChange={(name, value) => setValues((cur) => ({ ...cur, [name]: value }))}
      onAccept={() => setState("accepted")}
      onDecline={() => setState("declined")}
    />
  );
}
