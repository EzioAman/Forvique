"use client";
import { ImageGallery } from "@harness/components/image-gallery";
import type { V } from "../types";

const SEEDS = ["tulips", "keukenhof", "windmill", "canal", "bulbfield", "amsterdam", "lisse", "bloom", "garden", "spring", "petals", "meadow"];

export default function Demo({ v }: { v: V }) {
  const images = SEEDS.slice(0, Number(v.images)).map((seed, i) => ({
    id: seed,
    src: `https://picsum.photos/seed/${seed}/600/400`,
    alt: `Search result ${i + 1}: ${seed}`,
    caption: v.captions === "On" ? `Tulip festival photo ${i + 1}` : undefined,
    source: v.captions === "On" ? { label: "picsum.photos", url: `https://picsum.photos/seed/${seed}/600/400` } : undefined,
  }));
  return <ImageGallery images={images} maxVisible={Number(v.maxVisible)} />;
}
