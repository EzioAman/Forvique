const Footer = () => {
    return (
        <footer className="bg-white dark:bg-neutral-950 relative z-[50] border-t border-neutral-200 dark:border-neutral-800">
            <div className="mx-auto px-6 py-14 md:grid-cols-6 grid max-w-[1024px] grid-cols-6 gap-x-8 gap-y-10">
                <div className="md:col-span-1 col-span-6 flex">
                    <a className="items-center flex">
                        <div className="h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br flex from-neutral-800 to-neutral-600 dark:from-neutral-200 dark:to-neutral-400">
                            { /* SVG79 */}
                        </div>
                    </a>
                </div>
                <div className="md:col-span-1 col-span-3">
                    <p className="mb-6 text-[13px] font-medium text-neutral-900 md:mb-6 dark:text-neutral-100">Product</p>
                    <ul className="text-[13px] space-y-0.5">
                        <li>
                            <a className="items-center text-neutral-600 flex min-h-7 transition-colors hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100">Features</a>
                        </li>
                        <li>
                            <a className="items-center text-neutral-600 flex min-h-7 transition-colors hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100">Pricing</a>
                        </li>
                        <li>
                            <a className="items-center text-neutral-600 flex min-h-7 transition-colors hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100">Integrations</a>
                        </li>
                        <li>
                            <a className="items-center text-neutral-600 flex min-h-7 transition-colors hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100">Security</a>
                        </li>
                    </ul>
                </div>
                <div className="md:col-span-1 col-span-3">
                    <p className="mb-6 text-[13px] font-medium text-neutral-900 md:mb-6 dark:text-neutral-100">Company</p>
                    <ul className="text-[13px] space-y-0.5">
                        <li>
                            <a className="items-center text-neutral-600 flex min-h-7 transition-colors hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100">About</a>
                        </li>
                        <li>
                            <a className="items-center text-neutral-600 flex min-h-7 transition-colors hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100">Blog</a>
                        </li>
                        <li>
                            <a className="items-center text-neutral-600 flex min-h-7 transition-colors hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100">Careers</a>
                        </li>
                        <li>
                            <a className="items-center text-neutral-600 flex min-h-7 transition-colors hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100">Contact</a>
                        </li>
                    </ul>
                </div>
                <div className="md:col-span-1 col-span-3">
                    <p className="mb-6 text-[13px] font-medium text-neutral-900 md:mb-6 dark:text-neutral-100">Resources</p>
                    <ul className="text-[13px] space-y-0.5">
                        <li>
                            <a className="items-center text-neutral-600 flex min-h-7 transition-colors hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100">Documentation</a>
                        </li>
                        <li>
                            <a className="items-center text-neutral-600 flex min-h-7 transition-colors hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100">Help Center</a>
                        </li>
                        <li>
                            <a className="items-center text-neutral-600 flex min-h-7 transition-colors hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100">Community</a>
                        </li>
                        <li>
                            <a className="items-center text-neutral-600 flex min-h-7 transition-colors hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100">Status</a>
                        </li>
                    </ul>
                </div>
                <div className="md:col-span-1 col-span-3">
                    <p className="mb-6 text-[13px] font-medium text-neutral-900 md:mb-6 dark:text-neutral-100">Legal</p>
                    <ul className="text-[13px] space-y-0.5">
                        <li>
                            <a className="items-center text-neutral-600 flex min-h-7 transition-colors hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100">Privacy</a>
                        </li>
                        <li>
                            <a className="items-center text-neutral-600 flex min-h-7 transition-colors hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100">Terms</a>
                        </li>
                        <li>
                            <a className="items-center text-neutral-600 flex min-h-7 transition-colors hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100">Cookie Policy</a>
                        </li>
                    </ul>
                </div>
                <div className="md:col-span-1 col-span-3">
                    <p className="mb-6 text-[13px] font-medium text-neutral-900 md:mb-6 dark:text-neutral-100">Connect</p>
                    <ul className="text-[13px] space-y-0.5">
                        <li>
                            <a className="items-center text-neutral-600 flex min-h-7 transition-colors hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100">Twitter</a>
                        </li>
                        <li>
                            <a className="items-center text-neutral-600 flex min-h-7 transition-colors hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100">LinkedIn</a>
                        </li>
                        <li>
                            <a className="items-center text-neutral-600 flex min-h-7 transition-colors hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100">GitHub</a>
                        </li>
                    </ul>
                </div>
            </div>
        </footer>
    );
};

export default Footer;
