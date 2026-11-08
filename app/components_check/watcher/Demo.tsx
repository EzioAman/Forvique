"use client";
import { Panel } from "../Panel";
import { SHAPES, Watcher } from "./Watcher";

export function Demo({ accepted }: { accepted: boolean }) {
  return (
    <>
      <div className="cc-stage board">
        <Watcher />
      </div>
      <Panel
        group="watcher"
        title="Eye tracker"
        description="Two eyes on a soft cube that turn to follow your cursor around the block."
        icon={{ shape: SHAPES }}
        accepted={accepted}
      />
    </>
  );
}
