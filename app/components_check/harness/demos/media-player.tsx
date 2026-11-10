"use client";
import { AudioPlayer, VideoPlayer, type VideoPlayerProps } from "@harness/components/media-player";
import type { V } from "../types";

export default function Demo({ v }: { v: V }) {
  if (v.player === "Video") {
    return (
      <VideoPlayer
        src="https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4"
        poster={v.poster === "On" ? "https://picsum.photos/seed/flower/600/400" : undefined}
        title={v.title === "On" ? "Screen recording: agent run" : undefined}
        ratio={String(v.ratio) as VideoPlayerProps["ratio"]}
      />
    );
  }
  return (
    <AudioPlayer
      src="https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3"
      title={v.title === "On" ? "Generated voice summary" : undefined}
      artwork={v.artwork === "On" ? "https://picsum.photos/seed/podcast/600/400" : undefined}
    />
  );
}
