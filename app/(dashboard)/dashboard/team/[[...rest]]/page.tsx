import { auth } from '@clerk/nextjs/server';
import { OrganizationProfile } from '@clerk/nextjs';
import { Suspense } from 'react';
import { OrgSyncLoader } from '@/components/org-sync-loader';

export const instant = false;

export default async function TeamPage() {
  const { orgId } = await auth.protect();

  if (!orgId) {
    return <OrgSyncLoader />;
  }

  return (
    <div className="space-y-6">

      <div className="flex justify-start">
        <Suspense fallback={<p className="text-sm text-neutral-500">Loading team settings...</p>}>
          <OrganizationProfile
            routing="path"
            path="/dashboard/team"
            appearance={{
              elements: {
                rootBox: 'w-full shadow-none',
                cardBox: 'w-full shadow-none border-none bg-transparent p-0',
              },
            }}
          />
        </Suspense>
      </div>
    </div>
  );
}
