"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const title = (s: string) => s.replace(/[-_]/g, " ").replace(/^./, (c) => c.toUpperCase());

function Group({ label, items, href }: { label: string; items: string[]; href?: (s: string) => string }) {
  const path = usePathname();
  return (
    <div className="cc-group">
      <h2>{label}</h2>
      {items.length === 0 && <p className="cc-empty">None yet</p>}
      {items.map((s) => {
        const to = href?.(s);
        return to ? (
          <Link key={s} href={to} className="cc-link" aria-current={path === to ? "page" : undefined}>{title(s)}</Link>
        ) : (
          <span key={s} className="cc-link">{title(s)}</span>
        );
      })}
    </div>
  );
}

export function Nav({ review, ready, ui, harness }: {
  review: string[]; ready: string[]; ui: string[]; harness: { review: string[]; ready: string[] };
}) {
  const to = (s: string) => `/components_check/${s}`;
  const hk = (s: string) => `/components_check/harness/${s}`;
  return (
    <nav className="cc-side" aria-label="Components">
      <p className="cc-brand">Forvique components</p>
      <Group label="In review" items={review} href={to} />
      <Group label="Ready to use" items={ready} href={to} />
      <Group label="components/ui" items={ui} />
      <Group label="Harness: in review" items={harness.review} href={hk} />
      <Group label="Harness: ready to use" items={harness.ready} href={hk} />
    </nav>
  );
}
