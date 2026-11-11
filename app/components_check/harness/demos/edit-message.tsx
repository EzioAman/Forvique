"use client";
import { useState } from "react";
import { EditMessage } from "@harness/components/edit-message";
import type { V } from "../types";

export default function Demo({ v }: { v: V }) {
  const [text, setText] = useState("Find every call to fetchUser and add a timeout of 5 seconds.");
  return (
    <EditMessage
      value={text}
      discardedReplies={Number(v.discarded)}
      editing={v.editing === "On"}
      onValueChange={setText}
      onSave={() => {}}
      onCancel={() => {}}
      onStartEdit={() => {}}
    />
  );
}
