export default function DashboardLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-neutral-200 dark:border-neutral-800">
        <div>
          <div className="h-7 w-48 bg-neutral-200 dark:bg-neutral-800 rounded-md" />
          <div className="h-4 w-64 bg-neutral-200 dark:bg-neutral-800 rounded-md mt-2" />
        </div>
        <div className="h-9 w-32 bg-neutral-200 dark:bg-neutral-800 rounded-md" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-28 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4" />
        ))}
      </div>

      <div className="h-64 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-6" />
    </div>
  );
}

