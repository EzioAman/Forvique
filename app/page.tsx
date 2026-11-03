import Link from 'next/link';
import { Suspense } from 'react';
import { SignInButton, SignUpButton, Show, UserButton } from '@clerk/nextjs';
import { ThemeToggle } from '@/components/theme-toggle';

export const metadata = {
  title: 'Forvique — Autonomous Intelligence & CRM',
  description: 'AI agents that actually do the job. Unified autonomous workspace.',
};

export default function HomePage() {
  return (
    <div className="min-h-screen bg-white text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100 flex flex-col justify-between antialiased selection:bg-neutral-200 dark:selection:bg-neutral-800">
      {/* Top Navigation */}
      <header className="fixed top-0 inset-x-0 z-50 h-16 border-b border-neutral-200/80 dark:border-neutral-800/80 bg-white/80 dark:bg-neutral-950/80 backdrop-blur-md">
        <div className="max-w-6xl mx-auto h-full px-6 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 font-bold tracking-tight text-neutral-900 dark:text-white">
            <div className="h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br flex from-neutral-800 to-neutral-900 dark:from-neutral-100 dark:to-neutral-300">
              <span className="text-white dark:text-neutral-900 font-bold text-sm">F</span>
            </div>
            <span className="text-base tracking-tight font-semibold">Forvique</span>
          </Link>

          <div className="flex items-center gap-3">
            <Link
              href="/ai"
              className="text-xs font-medium px-3 py-1.5 rounded-lg text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:text-white dark:hover:bg-neutral-900 transition-colors hidden sm:inline-block"
            >
              AI Workspace
            </Link>
            <ThemeToggle />
            <Suspense fallback={null}>
              <Show when="signed-out">
                <SignInButton>
                  <button
                    type="button"
                    className="h-8 items-center rounded-lg px-3 text-[13px] font-medium text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:text-white dark:hover:bg-neutral-900 transition-colors cursor-pointer"
                  >
                    Log in
                  </button>
                </SignInButton>
                <SignUpButton>
                  <button
                    type="button"
                    className="h-8 items-center justify-center rounded-lg bg-neutral-900 px-3.5 text-[13px] font-medium text-white hover:bg-neutral-800 dark:bg-neutral-100 dark:text-neutral-950 dark:hover:bg-neutral-200 transition-colors cursor-pointer"
                  >
                    Start Free
                  </button>
                </SignUpButton>
              </Show>
              <Show when="signed-in">
                <Link
                  href="/dashboard"
                  className="h-8 items-center rounded-lg bg-neutral-900 px-3 text-[13px] font-medium text-white dark:bg-neutral-100 dark:text-neutral-950 flex transition-all hover:opacity-90"
                >
                  Dashboard
                </Link>
                <UserButton />
              </Show>
            </Suspense>
          </div>
        </div>
      </header>

      {/* Main Hero */}
      <main className="flex-1 flex flex-col items-center justify-center pt-24 pb-16 px-6">
        <div className="max-w-3xl mx-auto text-center flex flex-col items-center">
          {/* Heading */}
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-medium tracking-tight text-neutral-900 dark:text-neutral-100 leading-[1.12] text-balance">
            Autonomous intelligence built for builders.
          </h1>

          {/* Subheading */}
          <p className="mt-6 text-base sm:text-lg text-neutral-600 dark:text-neutral-400 max-w-xl text-balance leading-relaxed">
            Experience our newly designed intelligent command interface with real-time protocol execution and telemetry.
          </p>

          {/* Primary CTA Button to /ai */}
          <div className="mt-10 flex flex-col sm:flex-row items-center gap-4">
            <Link
              href="/ai"
              className="h-12 w-full sm:w-auto inline-flex items-center justify-center gap-2.5 rounded-xl bg-neutral-900 px-7 text-sm font-medium text-white shadow-sm transition-all hover:bg-neutral-800 dark:bg-neutral-100 dark:text-neutral-950 dark:hover:bg-neutral-200 group"
            >
              <span>Go to AI Page</span>
              <svg
                className="w-4 h-4 transition-transform group-hover:translate-x-1"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </Link>

            <Link
              href="/dashboard"
              className="h-12 w-full sm:w-auto inline-flex items-center justify-center rounded-xl border border-neutral-200 dark:border-neutral-800 px-6 text-sm font-medium text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-900 transition-colors"
            >
              Open Dashboard
            </Link>
          </div>
        </div>
      </main>

      {/* Minimal Footer */}
      <footer className="border-t border-neutral-200 dark:border-neutral-800 py-6 px-6">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-neutral-500 dark:text-neutral-400">
          <p>© 2026 Forvique, Inc. All rights reserved.</p>
          <div className="flex items-center gap-6">
            <Link href="/ai" className="hover:text-neutral-900 dark:hover:text-white transition-colors">
              AI Command
            </Link>
            <Link href="/dashboard" className="hover:text-neutral-900 dark:hover:text-white transition-colors">
              Workspace
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
