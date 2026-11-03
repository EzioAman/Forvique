'use client';

import { createClient } from '@supabase/supabase-js';
import { useSession } from '@clerk/nextjs';
import { useMemo } from 'react';
import { envClient } from '@/lib/env.client';

/**
 * Client-side Supabase hook authenticated with the Clerk session token.
 * 
 * - One session system: Persist session and refresh tokens are disabled.
 * - Dynamically attaches the Clerk session token on every Supabase request.
 * - If unauthenticated, returns null to avoid sending malformed empty Bearer headers.
 */
export function useSupabaseClient() {
  const { session } = useSession();

  return useMemo(() => {
    return createClient(
      envClient.NEXT_PUBLIC_SUPABASE_URL,
      envClient.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
        accessToken: async () => {
          try {
            const token = await session?.getToken();
            return token ?? null;
          } catch {
            return null;
          }
        },
      }
    );
  }, [session]);
}
