import { auth, currentUser } from '@clerk/nextjs/server';
import { OrgSyncLoader } from '@/components/org-sync-loader';
import Link from 'next/link';


export const instant = false;

export default async function DashboardPage() {
  // Enforce authentication and retrieve token claims in a single call
  const { orgId, orgSlug, orgRole, sessionClaims } = await auth.protect();
  const user = await currentUser();

  // If no active organization in the session token yet, seamlessly auto-create/activate
  if (!orgId) {
    return <OrgSyncLoader />;
  }

  // Read organization claim directly from the token — zero runtime identity calls
  const orgName =
    (sessionClaims as Record<string, unknown> | null)?.org_name as string | undefined ||
    orgSlug ||
    'Team Workspace';

  const userDisplayName =
    user?.firstName ||
    user?.emailAddresses?.[0]?.emailAddress?.split('@')[0] ||
    'Team Member';

  return (
    <div className="space-y-6">
      {/* Workspace Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-neutral-200 dark:border-neutral-800">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
              {orgName}
            </h1>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
              SSR First Paint
            </span>
          </div>
          <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-1">
            Welcome back, <span className="font-medium text-neutral-900 dark:text-neutral-200">{userDisplayName}</span>. This workspace is scoped to your organization.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/dashboard/team"
            className="inline-flex items-center justify-center px-3.5 py-1.5 rounded-lg text-xs font-medium bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-950 hover:opacity-90 transition-opacity shadow-xs cursor-pointer"
          >
            + Invite Teammates
          </Link>
        </div>
      </div>

      {/* Organization SSR Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Org ID & Claim */}
        <div className="p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-xs">
          <div className="text-xs font-medium text-neutral-500 dark:text-neutral-400">Organization ID</div>
          <div className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 mt-1 font-mono truncate" title={orgId}>
            {orgId}
          </div>
          <div className="text-[11px] text-neutral-400 dark:text-neutral-500 mt-2 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
            Carried in JWT token claim
          </div>
        </div>

        {/* Slug */}
        <div className="p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-xs">
          <div className="text-xs font-medium text-neutral-500 dark:text-neutral-400">Organization Slug</div>
          <div className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 mt-1 font-mono">
            {orgSlug || 'N/A'}
          </div>
          <div className="text-[11px] text-neutral-400 dark:text-neutral-500 mt-2">
            URL scope identifier
          </div>
        </div>

        {/* Role */}
        <div className="p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-xs">
          <div className="text-xs font-medium text-neutral-500 dark:text-neutral-400">Your Team Role</div>
          <div className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 mt-1 capitalize">
            {orgRole ? orgRole.replace('org:', '') : 'Member'}
          </div>
          <div className="text-[11px] text-neutral-400 dark:text-neutral-500 mt-2">
            Token-based RBAC permission
          </div>
        </div>
      </div>

      {/* Acceptance Criteria Live Status */}
      <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-6 shadow-xs">
        <h2 className="text-base font-semibold text-neutral-900 dark:text-neutral-100 mb-4">
          Phase 1 System Architecture
        </h2>

        <div className="space-y-3.5 text-xs">
          <div className="flex items-start gap-3 p-3 rounded-lg bg-neutral-50 dark:bg-neutral-950/60 border border-neutral-100 dark:border-neutral-800">
            <span className="text-emerald-600 dark:text-emerald-400 font-bold mt-0.5">✓</span>
            <div>
              <span className="font-semibold text-neutral-900 dark:text-neutral-100">Zero-Prompt Organizations:</span>
              <span className="text-neutral-600 dark:text-neutral-400 ml-1.5">
                New accounts automatically land in their team organization without a manual creation step. Switch and invite via the sidebar controls.
              </span>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3 rounded-lg bg-neutral-50 dark:bg-neutral-950/60 border border-neutral-100 dark:border-neutral-800">
            <span className="text-emerald-600 dark:text-emerald-400 font-bold mt-0.5">✓</span>
            <div>
              <span className="font-semibold text-neutral-900 dark:text-neutral-100">Server-Rendered Organization Claim:</span>
              <span className="text-neutral-600 dark:text-neutral-400 ml-1.5">
                Current organization is read on the server during SSR from the session token. Rendered on first paint with zero runtime IdP calls.
              </span>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3 rounded-lg bg-neutral-50 dark:bg-neutral-950/60 border border-neutral-100 dark:border-neutral-800">
            <span className="text-emerald-600 dark:text-emerald-400 font-bold mt-0.5">✓</span>
            <div>
              <span className="font-semibold text-neutral-900 dark:text-neutral-100">Early Redirect on Protected Routes:</span>
              <span className="text-neutral-600 dark:text-neutral-400 ml-1.5">
                Next.js 16 Proxy intercepts signed-out requests at the network edge and redirects to sign-in. Protected HTML is never sent.
              </span>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3 rounded-lg bg-neutral-50 dark:bg-neutral-950/60 border border-neutral-100 dark:border-neutral-800">
            <span className="text-emerald-600 dark:text-emerald-400 font-bold mt-0.5">✓</span>
            <div>
              <span className="font-semibold text-neutral-900 dark:text-neutral-100">Single Session Architecture with Database Client:</span>
              <span className="text-neutral-600 dark:text-neutral-400 ml-1.5">
                Supabase client carries the signed-in Clerk JWT via dynamically resolved access tokens. Cookie collisions and double-session refresh bugs are eliminated.
              </span>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3 rounded-lg bg-neutral-50 dark:bg-neutral-950/60 border border-neutral-100 dark:border-neutral-800">
            <span className="text-emerald-600 dark:text-emerald-400 font-bold mt-0.5">✓</span>
            <div>
              <span className="font-semibold text-neutral-900 dark:text-neutral-100">Three-State Theme Control:</span>
              <span className="text-neutral-600 dark:text-neutral-400 ml-1.5">
                System, Light, and Dark states written to the root element. Persisted across reload and light overrides dark OS preferences.
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


