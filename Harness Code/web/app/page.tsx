import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 p-6 text-center">
      <h1 className="text-3xl font-semibold tracking-tight">Harness</h1>
      <p className="max-w-md text-muted-foreground">
        A coding agent that plans, uses tools and hands every change back for review.
      </p>
      <Link
        href="/harness"
        className="rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground"
      >
        Open Harness
      </Link>
    </main>
  );
}
