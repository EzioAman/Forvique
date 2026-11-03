import { auth } from '@clerk/nextjs/server';
import { ThemeToggle } from '@/components/theme-toggle';


export const instant = false;

export default async function SettingsPage() {
  await auth.protect();
  const { orgId, orgRole, sessionClaims } = await auth();

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Theme Settings Section */}
      <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
              Appearance & Theme
            </h2>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
              Choose between System (follows OS preference), Force Light, or Force Dark. Written to the document root element.
            </p>
          </div>
          <ThemeToggle />
        </div>
      </div>

      {/* Session & Security Details */}
      <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-6 shadow-xs">
        <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 mb-1">
          Active Token Claims
        </h2>
        <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-4">
          Identity is a verified JWT token. Downstream policies and the database client read these claims directly without querying the identity provider.
        </p>

        <div className="p-3 rounded-lg bg-neutral-50 dark:bg-neutral-950 font-mono text-xs overflow-x-auto text-neutral-700 dark:text-neutral-300 border border-neutral-200/60 dark:border-neutral-800/60">
          <pre>{JSON.stringify({ orgId, orgRole, sessionClaims }, null, 2)}</pre>
        </div>
      </div>
    </div>
  );
}


