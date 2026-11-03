/**
 * Loud environment variable validation.
 * Fails loudly at boot if any required variable is missing or blank.
 */

function requireEnv(key: string, value: string | undefined, isServerOnly = false): string {
  if (isServerOnly && typeof window !== 'undefined') {
    return '';
  }
  if (!value || value.trim() === '') {
    throw new Error(
      `[FATAL] Missing required environment variable: "${key}". The application cannot start without this configuration.`
    );
  }
  return value.trim();
}

export const env = {
  // Clerk
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: requireEnv(
    'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY',
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
  ),
  CLERK_SECRET_KEY: requireEnv(
    'CLERK_SECRET_KEY',
    process.env.CLERK_SECRET_KEY,
    true
  ),

  // Supabase
  NEXT_PUBLIC_SUPABASE_URL: requireEnv(
    'NEXT_PUBLIC_SUPABASE_URL',
    process.env.NEXT_PUBLIC_SUPABASE_URL
  ),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: requireEnv(
    'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ),
} as const;
