"use client";
import { Panel } from "../Panel";
import { Signature } from "./Signature";

export function Demo({ accepted }: { accepted: boolean }) {
  return (
    <>
      <div className="cc-stage">
        <Signature />
      </div>
      <Panel
        group="signature"
        title="Signature pad"
        description="Sign on the line. The ink thins with speed, and a pause folds the pad into a Signed pill."
        accepted={accepted}
      />
    </>
  );
}
