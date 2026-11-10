"use client";
import {
  ImageActions,
  ImageContentFilterError,
  ImageFilename,
  ImageGenerating,
  ImagePreview,
  ImageRoot,
  ImageSource,
  ImageZoom,
} from "@harness/components/image";
import type { V } from "../types";

// Inline SVG so the demo needs no network.
const SRC =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="500"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#6366f1"/><stop offset="1" stop-color="#0ea5e9"/></linearGradient></defs><rect width="800" height="500" fill="url(#g)"/><circle cx="560" cy="180" r="90" fill="#fff" fill-opacity=".25"/><path d="M0 420 L220 260 L400 380 L560 300 L800 440 L800 500 L0 500Z" fill="#0f172a" fill-opacity=".35"/></svg>`,
  );
const NAME = "architecture-diagram.png";

type Variant = "outline" | "ghost" | "muted";
type Size = "sm" | "default" | "lg" | "full";
type Ratio = "auto" | "1:1" | "4:3" | "16:9" | "9:16";

export default function Demo({ v }: { v: V }) {
  return (
    <ImageRoot variant={v.variant as Variant} size={v.size as Size}>
      {v.state === "Generating" ? (
        <ImageGenerating />
      ) : v.state === "Blocked" ? (
        <ImageContentFilterError reason="The provider blocked this image." />
      ) : (
        <ImageZoom src={SRC} alt={NAME}>
          <ImagePreview src={SRC} alt={NAME} ratio={v.ratio as Ratio} fit={v.fit as "cover" | "contain"} />
        </ImageZoom>
      )}
      {v.filename === "On" && <ImageFilename>{NAME}</ImageFilename>}
      {v.source === "On" && <ImageSource label="docs.example.com" url="https://docs.example.com/architecture" />}
      {v.actions === "On" && v.state === "Ready" && (
        <ImageActions part={{ type: "image", image: SRC, filename: NAME }} />
      )}
    </ImageRoot>
  );
}
