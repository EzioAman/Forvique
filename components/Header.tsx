const Header = () => {
    return (
        <header className="bg-white/80 px-6 dark:bg-neutral-950/80 fixed top-0 right-0 left-0 z-[100] border-b border-neutral-200/80 backdrop-blur-[20px] dark:border-neutral-800/80">
            <nav className="mx-auto h-16 items-center justify-between flex max-w-[1024px]">
                <a className="items-center rounded-md px-2 py-1 -ml-2 flex">
                    <div className="h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br flex from-neutral-800 to-neutral-900 dark:from-neutral-200 dark:to-neutral-400">
                        { /* SVG1 */}
                    </div>
                </a>
                <div className="items-center flex gap-2">
                    <ul className="ml-2 items-center md:flex hidden gap-2">
                        <li>
                            <a className="h-8 items-center rounded-lg px-3 text-[13px] font-medium text-neutral-600 flex transition-all hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-100">Features</a>
                        </li>
                        <li>
                            <a className="h-8 items-center rounded-lg px-3 text-[13px] font-medium text-neutral-600 flex transition-all hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-100">Pricing</a>
                        </li>
                        <li>
                            <a className="h-8 items-center rounded-lg px-3 text-[13px] font-medium text-neutral-600 flex transition-all hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-100">Why CRM</a>
                        </li>
                    </ul>
                </div>
                <div className="items-center flex gap-2">
                    <a className="h-8 items-center rounded-lg px-3 text-[13px] font-medium text-neutral-600 md:flex hidden transition-all hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-100">Log in</a>
                    <a className="h-8 items-center justify-center rounded-lg bg-neutral-900 px-4 text-[13px] font-medium text-white shadow-[0_-1px_1px_0px_rgba(0,0,0,0.11)_inset,0_8px_2px_0px_transparent,0_5px_2px_0px_rgba(0,0,0,0.01),0_3px_2px_0px_rgba(0,0,0,0.04),0_1px_1px_0px_rgba(0,0,0,0.07),0_0px_1px_0px_rgba(0,0,0,0.08)] dark:bg-neutral-100 flex transition-all hover:bg-neutral-800 dark:text-neutral-950 dark:hover:bg-neutral-200">Start Free</a>
                    <button type="button" className="-mr-6 flex h-16 w-16 items-center justify-center md:hidden">
                        { /* SVG2 */}
                    </button>
                </div>
            </nav>
        </header>
    );
};

export default Header;
