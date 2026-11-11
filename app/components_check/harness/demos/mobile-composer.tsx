"use client";
import { useState } from "react";
import { MobileComposer } from "@harness/components/mobile-composer";
import type { V } from "../types";

const ACTIONS = ["Search the web", "Run tests", "Open a PR", "Explain code", "Deploy preview"];

export default function Demo({ v }: { v: V }) {
  const [text, setText] = useState("");
  return (
    <MobileComposer
      value={text}
      keyboardOpen={v.keyboard === "On"}
      running={v.running === "On"}
      actions={ACTIONS.slice(0, Number(v.actions))}
      onAction={setText}
      onAttach={() => {}}
      onValueChange={setText}
      onSend={() => setText("")}
      onStop={() => {}}
    />
  );
}
