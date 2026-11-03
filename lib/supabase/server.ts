import { createClient } from '@supabase/supabase-js';
import { auth } from '@clerk/nextjs/server';
import { env } from '@/lib/env';

/**
 * Server-side Supabase client authenticated with the Clerk session token.
 * 
 * - One session system: Persist session and refresh tokens are disabled.
 * - The database client carries the signed-in token on every request,
 *   enabling Supabase RLS policies to read claims via auth.jwt().
 * - If unauthenticated, returns null to avoid sending malformed empty Bearer headers.
 */
export async function createClerkSupabaseClient() {
  const { getToken } = await auth();

  return createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
      accessToken: async () => {
        try {
          const token = await getToken();
          return token ?? null;
        } catch {
          return null;
        }
      },
    }
  );
}
