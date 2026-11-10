"use client";
import { useEffect, useState } from "react";
import { WebPreview } from "@harness/components/web-preview";
import type { V } from "../types";

const LONG = "https://preview-3f9a2c.harness-sandbox.dev/dashboard/settings?tab=billing";

export default function Demo({ v }: { v: V }) {
  const [loading, setLoading] = useState(v.loading === "On");
  useEffect(() => setLoading(v.loading === "On"), [v.loading]);
  const reload = () => {
    setLoading(true);
    setTimeout(() => setLoading(v.loading === "On"), 1500);
  };
  return (
    <WebPreview
      origin={v.origin === "Long" ? LONG : "localhost:5173"}
      loading={loading}
      onReload={reload}
      onOpenExternal={() => {}}
    >
      <img
        src="https://picsum.photos/seed/dashboard/600/400"
        alt="Preview of the generated dashboard"
        className="w-full"
      />
    </WebPreview>
  );
}
