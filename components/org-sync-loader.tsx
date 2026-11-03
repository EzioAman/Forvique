// Do not change this file

'use client';

import { useOrganizationList } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useRef } from 'react';
import { ensureUserOrganization } from '@/app/actions/org';

export function OrgSyncLoader() {
  const { isLoaded, setActive } = useOrganizationList({
    userMemberships: { infinite: true },
  });
  const router = useRouter();
  const [status, setStatus] = useState('Connecting to your workspace...');
  const [error, setError] = useState<string | null>(null);
  const attempts = useRef(0);

  useEffect(() => {
    let isSubscribed = true;

    async function sync() {
      if (!isLoaded || !setActive) return;

      if (attempts.current >= 3) {
        if (isSubscribed) {
          setError('Unable to activate your workspace automatically. Please refresh or retry.');
        }
        return;
      }

      attempts.current += 1;

      try {
        const { orgId } = await ensureUserOrganization();
        if (!isSubscribed) return;

        if (orgId) {
          setStatus('Activating workspace...');
          await setActive({ organization: orgId });
          router.refresh();
        } else {
          setError('No organization could be found or created.');
        }
      } catch (err: unknown) {
        if (!isSubscribed) return;
        const message = err instanceof Error ? err.message : 'Unknown error occurred';
        console.error('Failed to sync organization:', err);
        setError(`Failed to set up workspace: ${message}`);
      }
    }

    sync();

    return () => {
      isSubscribed = false;
    };
  }, [isLoaded, setActive, router]);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] p-8 text-center max-w-md mx-auto">
        <div className="w-10 h-10 rounded-full bg-red-100 text-red-600 dark:bg-red-950/60 dark:text-red-400 flex items-center justify-center font-bold mb-4">
          !
        </div>
        <h2 className="text-base font-semibold text-neutral-900 dark:text-neutral-100 mb-1">
          Workspace Setup Issue
        </h2>
        <p className="text-xs text-neutral-600 dark:text-neutral-400 mb-5">
          {error}
        </p>
        <button
          onClick={() => {
            attempts.current = 0;
            setError(null);
            setStatus('Retrying workspace setup...');
            router.refresh();
          }}
          className="px-4 py-2 text-xs font-medium rounded-lg bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900 hover:opacity-90 transition-opacity"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] p-8 text-center">
      <div className="w-6 h-6 border-2 border-neutral-300 dark:border-neutral-700 border-t-neutral-900 dark:border-t-neutral-100 rounded-full animate-spin mb-4" />
      <p className="text-sm font-medium text-neutral-800 dark:text-neutral-200">
        {status}
      </p>
      <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
        Configuring organization security boundaries...
      </p>
    </div>
  );
}

// Backward compatibility alias
export { OrgSyncLoader as OrgSync };

