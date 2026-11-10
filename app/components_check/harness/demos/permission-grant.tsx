"use client";
import { useState } from "react";
import { PermissionGrant, type GrantScope } from "@harness/components/permission-grant";
import type { V } from "../types";

const SCOPE: Record<string, GrantScope | "pending"> = { Pending: "pending", Session: "session", Always: "always", Denied: "denied" };
const REACH = ["Read files in ~/projects/forvique", "Create and edit files there", "Run git commands", "Push to remote branches"];

export default function Demo({ v }: { v: V }) {
  // a click overrides the picked scope until the option changes
  const [picked, setPicked] = useState<{ from: string | number; scope: GrantScope }>();
  const scope = picked?.from === v.scope ? picked.scope : SCOPE[v.scope] ?? "pending";
  return (
    <PermissionGrant
      capability="Workspace write access"
      requester="Coding agent"
      reach={REACH.slice(0, Number(v.reach))}
      scope={scope}
      onGrant={v.buttons === "On" ? (s) => setPicked({ from: v.scope, scope: s }) : undefined}
    />
  );
}
