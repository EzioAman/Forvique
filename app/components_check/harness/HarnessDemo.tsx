"use client";
import { lazy, Suspense, type ComponentType } from "react";
import { useSettings } from "../../../lib/settings";
import { Panel } from "../Panel";
import { group, HARNESS } from "./registry";
import type { V } from "./types";

const loaded = new Map<string, ComponentType<{ v: V }>>();
const demo = (slug: string) => {
  if (!loaded.has(slug)) loaded.set(slug, lazy(() => import(`./demos/${slug}.tsx`)));
  return loaded.get(slug)!;
};

/* The stage renders the copied Harness component inside .hk, which turns on Harness's tokens (harness.css). */
export function HarnessDemo({ slug, accepted }: { slug: string; accepted: boolean }) {
  const v = useSettings()[group(slug)];
  const Demo = demo(slug);
  const m = HARNESS[slug];
  return (
    <>
      <div className="cc-stage">
        <div className="hk text-foreground w-full max-w-2xl p-8">
          <Suspense>
            <Demo v={v} />
          </Suspense>
        </div>
      </div>
      <Panel group={group(slug)} title={m.title} description={m.description} accepted={accepted} />
    </>
  );
}
