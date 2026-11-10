"use client";
import { useEffect, useState } from "react";
import { ImageGeneration } from "@harness/components/image-generation";
import type { V } from "../types";

const LONG = "A quiet tulip field at dusk in the Netherlands, windmill on the horizon, soft violet and peach sky, 35mm film look";

export default function Demo({ v }: { v: V }) {
  const [generating, setGenerating] = useState(v.state === "Generating");
  useEffect(() => setGenerating(v.state === "Generating"), [v.state]);
  return (
    <ImageGeneration
      prompt={v.prompt === "Long" ? LONG : "Tulip field at dusk"}
      generating={generating}
      onRegenerate={
        v.regenerate === "On"
          ? () => {
              setGenerating(true);
              setTimeout(() => setGenerating(false), 2500);
            }
          : undefined
      }
    />
  );
}
