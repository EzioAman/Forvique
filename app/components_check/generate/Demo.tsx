"use client";
import { Panel } from "../Panel";
import { Generate } from "./Generate";

/* src is a placeholder print drawn for this project: the real one has not been supplied yet */
export function Demo({ accepted }: { accepted: boolean }) {
  return (
    <>
      <div className="cc-stage">
        <Generate src="/placeholder-flower.svg" />
      </div>
      <Panel
        group="generate"
        title="Generate"
        description="A picture made in front of you: the large shapes first, the fine grain last, under a liquid surface that stills."
        accepted={accepted}
      />
    </>
  );
}
