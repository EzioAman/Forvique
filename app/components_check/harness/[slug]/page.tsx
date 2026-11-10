import { Suspense } from "react";
import { notFound } from "next/navigation";
import { readAccepted } from "../../accepted";
import { HarnessDemo } from "../HarnessDemo";
import { group, HARNESS } from "../registry";
import "../harness.css";

export const generateStaticParams = () => Object.keys(HARNESS).map((slug) => ({ slug }));

// params read inside Suspense, so the sidebar shell stays instant on navigation (cacheComponents)
export default function HarnessCheck({ params }: PageProps<"/components_check/harness/[slug]">) {
  return (
    <Suspense>
      {params.then(({ slug }) => {
        if (!HARNESS[slug]) notFound();
        return <HarnessDemo slug={slug} accepted={group(slug) in readAccepted()} />;
      })}
    </Suspense>
  );
}
