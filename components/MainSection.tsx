const MainSection = () => {
    return (
        <main className="pt-16">
            <section className="pt-12 relative isolate overflow-hidden">
                <div className="px-6 pb-0">
                    <div className="mx-auto max-w-[1024px]">
                        <div className="items-start flex flex-col">
                            <div className="h-8 md:h-8"></div>
                            <div className="mb-6"></div>
                            <p className="text-4xl leading-[1.1] font-medium tracking-[-0.022em] text-neutral-900 md:text-[56px] md:leading-[1.1] max-w-[900px] text-balance dark:text-neutral-100">
                                <span className="block">CRM that runs itself.</span>
                                <span className="text-neutral-600 block dark:text-neutral-400">So you can focus on building.</span>
                            </p>
                            <div className="h-5"></div>
                            <p className="text-[17px] leading-[24.5px] text-neutral-600 max-w-[600px] dark:text-neutral-400">Automated contact tracking, deal management, and follow-ups for freelancers, coaches, and indie founders. No setup. No learning curve. Just less admin work.</p>
                            <div className="h-6 md:h-[30px]"></div>
                            <div className="w-full items-center md:w-auto md:flex-row flex flex-col gap-4">
                                <a className="h-10 w-full items-center justify-center rounded-[10px] bg-neutral-900 px-6 text-[15px] font-medium text-white shadow-[0_-1px_1px_0px_rgba(0,0,0,0.11)_inset,0_8px_2px_0px_transparent,0_5px_2px_0px_rgba(0,0,0,0.01),0_3px_2px_0px_rgba(0,0,0,0.04),0_1px_1px_0px_rgba(0,0,0,0.07),0_0px_1px_0px_rgba(0,0,0,0.08)] md:w-auto dark:bg-neutral-100 flex transition-all hover:bg-neutral-800 dark:text-neutral-950 dark:hover:bg-neutral-200">Start free, stay organized</a>
                                <a className="h-10 w-full items-center justify-center rounded-[10px] px-4 text-[15px] font-medium text-neutral-700 md:w-auto flex gap-2.5 transition-all hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-900">
                                    <span className="bg-gradient-to-r text-transparent from-neutral-900 to-neutral-900/50 bg-clip-text dark:from-neutral-100 dark:to-neutral-100/50">Changelog: Latest app updates</span>
                                    { /* SVG3 */}
                                </a>
                            </div>
                            <div className="h-8"></div>
                            <div className="items-center text-[13px] text-neutral-500 flex gap-3 dark:text-neutral-500">
                                <div className="flex -space-x-2">
                                    <div className="h-8 w-8 rounded-full bg-neutral-300 dark:bg-neutral-700 border-2 border-white dark:border-neutral-950">
                                        <img alt="" src="https://devwares-pull-zone.b-cdn.net/mockimages/John%20Carter%20-%20Cirlce%20Small.png" className="rounded-full" />
                                    </div>
                                    <div className="h-8 w-8 rounded-full bg-neutral-400 dark:bg-neutral-600 border-2 border-white dark:border-neutral-950">
                                        <img alt="" src="https://devwares-pull-zone.b-cdn.net/mockimages/Mike%20Warren%20-%20Circle%20Small.png" className="rounded-full" />
                                    </div>
                                    <div className="h-8 w-8 rounded-full bg-neutral-500 dark:bg-neutral-500 border-2 border-white dark:border-neutral-950">
                                        <img alt="" src="https://devwares-pull-zone.b-cdn.net/mockimages/Sophie%20Moore%20-%20Circle%20Small.png" className="rounded-full" />
                                    </div>
                                </div>
                                <span>Trusted by 2,500+ solopreneurs</span>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="mt-8 px-6 md:mt-12 relative">
                    <div className="mx-auto">
                        <div style={{ perspective: '4000px', perspectiveOrigin: '100% 0px' }} className="h-[800px] w-full pointer-events-none relative overflow-hidden select-none">
                            <div style={{ transformStyle: 'preserve-3d' }} className="items-center justify-center absolute inset-0 flex">
                                <div style={{ transform: 'translate(2%) scale(1.1) rotateX(47deg) rotateY(31deg) rotate(324deg)', transformOrigin: '0px 0px', marginTop: '280px', transformStyle: 'preserve-3d' }} className="h-[800px] w-full rounded-[10px] bg-white dark:bg-neutral-950 absolute max-w-[1600px] border border-neutral-200 dark:border-neutral-800">
                                    <div className="absolute top-2 right-0 bottom-2 left-0 p-6">
                                        <img alt="" src="https://devwares-pull-zone.b-cdn.net/crm-mocks/crm-light.png" className="object-cover object-left-top dark:hidden h-full w-full" />
                                        <img alt="" src="https://devwares-pull-zone.b-cdn.net/crm-mocks/crm-dark.png" className="hidden object-cover object-left-top dark:block h-full w-full" />
                                        <div className="bg-gradient-to-r pointer-events-none absolute inset-0 from-transparent via-transparent to-white dark:to-neutral-950"></div>
                                    </div>
                                </div>
                            </div>
                            <div aria-hidden="" className="bg-gradient-to-b absolute inset-0 z-3 from-transparent from-25% to-white dark:to-neutral-950"></div>
                            <div aria-hidden="" className="bg-gradient-to-r absolute inset-0 z-4 from-transparent from-75% to-white dark:to-neutral-950"></div>
                            <div aria-hidden="" className="items-center px-5 py-24 absolute inset-0 z-2 size-full [background:radial-gradient(125%_125%_at_50%_10%,transparent_40%,rgb(255,255,255)_100%)] dark:[background:radial-gradient(125%_125%_at_50%_10%,transparent_40%,rgb(10,10,10)_100%)]"></div>
                        </div>
                    </div>
                </div>
            </section>
            <section className="px-6 py-20 md:py-32 relative">
                <div className="mx-auto max-w-[1024px]">
                    { /* More content */}
                </div>
            </section>
            { /* More sections */}
        </main>
    );
};

export default MainSection;
