"use client";
import { Panel } from "../Panel";
import { Seek } from "./Seek";

export function Demo({ accepted }: { accepted: boolean }) {
  return (
    <>
      <div className="cc-stage">
        <Seek />
      </div>
      <Panel
        group="seek"
        title="Seek"
        description="A search icon that becomes a search field: one object whose width is the state."
        accepted={accepted}
      />
    </>
  );
}
