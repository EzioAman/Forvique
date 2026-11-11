/* The Forvique landing page: the intro, then a link into the Harness web app (a separate deployment).
   Set NEXT_PUBLIC_HARNESS_URL to wherever Harness web is deployed, e.g. https://harness.example.com/harness.
   Unset, it points at /harness on this same site, which only works if Harness is served from here. */
const HARNESS_URL = process.env.NEXT_PUBLIC_HARNESS_URL ?? "/harness";

export default function Home() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-zinc-50 p-6 text-center dark:bg-black">
      <h1 className="text-3xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
        Welcome to Forvique AI Demo
      </h1>
      <p className="max-w-md text-zinc-600 dark:text-zinc-400">
        Harness is a coding agent that plans, uses tools and hands every change back for review.
      </p>
      <a
        href={HARNESS_URL}
        className="rounded-full bg-zinc-950 px-5 py-2.5 text-sm font-medium text-white dark:bg-zinc-50 dark:text-zinc-950"
      >
        Open Harness
      </a>
    </main>
  );
}
