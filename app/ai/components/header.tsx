import { SignInButton, SignUpButton, Show, UserButton } from '@clerk/nextjs';
import Link from 'next/link';
import { Suspense } from 'react';
import { ThemeToggle } from '@/components/theme-toggle';

const Header = () => {
    return (
        <header className="bg-white/80 px-6 dark:bg-neutral-950/80 fixed top-0 right-0 left-0 z-[100] border-b border-neutral-200/80 backdrop-blur-[20px] dark:border-neutral-800/80">
            <nav className="mx-auto h-16 items-center justify-between flex max-w-[1024px]">
                <Link href="/" className="items-center rounded-md px-2 py-1 -ml-2 flex gap-2">
                    <div className="h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br flex from-neutral-800 to-neutral-900 dark:from-neutral-200 dark:to-neutral-400">
                        <span className="text-white dark:text-neutral-900 font-bold text-sm">F</span>
                    </div>
                    <span className="font-semibold text-sm tracking-tight text-neutral-900 dark:text-white hidden sm:inline">Forvique</span>
                </Link>
                <div className="items-center flex gap-2">
                    <ul className="ml-2 items-center md:flex hidden gap-2">
                        <li>
                            <Link href="/" className="h-8 items-center rounded-lg px-3 text-[13px] font-medium text-neutral-600 flex transition-all hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-100">Home</Link>
                        </li>
                        <li>
                            <a href="#features" className="h-8 items-center rounded-lg px-3 text-[13px] font-medium text-neutral-600 flex transition-all hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-100">Features</a>
                        </li>
                        <li>
                            <a href="#pricing" className="h-8 items-center rounded-lg px-3 text-[13px] font-medium text-neutral-600 flex transition-all hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-100">Pricing</a>
                        </li>
                    </ul>
                </div>
                <div className="items-center flex gap-3">
                    <ThemeToggle />
                    <Suspense fallback={null}>
                        <Show when="signed-out">
                            <SignInButton>
                                <button type="button" className="h-8 items-center rounded-lg px-3 text-[13px] font-medium text-neutral-600 md:flex hidden transition-all hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-100 cursor-pointer">Log in</button>
                            </SignInButton>
                            <SignUpButton>
                                <button type="button" className="h-8 items-center justify-center rounded-lg bg-neutral-900 px-4 text-[13px] font-medium text-white shadow-[0_-1px_1px_0px_rgba(0,0,0,0.11)_inset,0_8px_2px_0px_transparent,0_5px_2px_0px_rgba(0,0,0,0.01),0_3px_2px_0px_rgba(0,0,0,0.04),0_1px_1px_0px_rgba(0,0,0,0.07),0_0px_1px_0px_rgba(0,0,0,0.08)] dark:bg-neutral-100 flex transition-all hover:bg-neutral-800 dark:text-neutral-950 dark:hover:bg-neutral-200 cursor-pointer">Start Free</button>
                            </SignUpButton>
                        </Show>
                        <Show when="signed-in">
                            <Link
                                href="/dashboard"
                                className="h-8 items-center rounded-lg bg-neutral-900 px-3 text-[13px] font-medium text-white dark:bg-neutral-100 dark:text-neutral-950 flex transition-all hover:opacity-90"
                            >
                                Open App
                            </Link>
                            <UserButton />
                        </Show>
                    </Suspense>
                </div>
            </nav>
        </header>
    );
};

export default Header;

