"use client";
import { LinkPreview } from "@harness/components/link-preview";
import type { V } from "../types";

const LONG = "Next.js 16: Cache Components, Turbopack by default, React Compiler support and a new routing model";

export default function Demo({ v }: { v: V }) {
  const on = (k: string) => v[k] === "On";
  return (
    <LinkPreview
      href="https://nextjs.org/blog/next-16"
      title={v.title === "Long" ? LONG : "Next.js 16"}
      description={
        on("description")
          ? "Turbopack is now the default bundler, caching is explicit with Cache Components, and route handlers get new defaults."
          : undefined
      }
      image={on("image") ? "https://picsum.photos/seed/nextjs/600/400" : undefined}
      imageAlt="Next.js 16 release banner"
      siteName={on("site") ? "Next.js Blog" : undefined}
      favicon={on("favicon") ? "https://nextjs.org/favicon.ico" : undefined}
      layout={v.layout === "compact" ? "compact" : "card"}
    />
  );
}
