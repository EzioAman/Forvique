import { SignIn } from "@clerk/nextjs";
import { Suspense } from "react";
import Link from "next/link";
import { ThemeToggle } from "@/components/theme-toggle";

export const metadata = {
  title: "Sign In — Forvique",
  description: "Sign in to your Forvique account.",
};

export default function SignInPage() {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col justify-between antialiased">
      {/* Top Bar with Home Link and Theme Toggle */}
      <header className="w-full max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5 font-bold tracking-tight text-neutral-900 dark:text-white">
          <div className="h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br flex from-neutral-800 to-neutral-900 dark:from-neutral-100 dark:to-neutral-300">
            <span className="text-white dark:text-neutral-900 font-bold text-sm">F</span>
          </div>
          <span className="text-sm font-semibold tracking-tight">Forvique</span>
        </Link>
        <ThemeToggle />
      </header>

      {/* Centered Sign In Card */}
      <main className="flex-1 flex items-center justify-center p-4">
        <Suspense
          fallback={
            <div className="h-[460px] w-full max-w-[400px] animate-pulse bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl" />
          }
        >
          <SignIn
            routing="path"
            path="/sign-in"
            signUpUrl="/sign-up"
            fallbackRedirectUrl="/dashboard"
          />
        </Suspense>
      </main>

      {/* Subtle Footer */}
      <footer className="py-4 text-center text-xs text-neutral-400 dark:text-neutral-600">
        <p>© 2026 Forvique, All Rights Reserved.</p>
      </footer>
    </div>
  );
}
