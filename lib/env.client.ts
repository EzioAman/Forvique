/**
 * Client-safe environment variables.
 * Only validates and exposes public keys safe for browser execution.
 */

function requirePublicEnv(key: string, value: string | undefined): string {
  if (!value || value.trim() === '') {
    throw new Error(
      `[FATAL] Missing required client environment variable: "${key}". The application cannot start without this configuration.`
    );
  }
  return value.trim();
}

export const envClient = {
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: requirePublicEnv(
    'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY',
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
  ),
  NEXT_PUBLIC_SUPABASE_URL: requirePublicEnv(
    'NEXT_PUBLIC_SUPABASE_URL',
    process.env.NEXT_PUBLIC_SUPABASE_URL
  ),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: requirePublicEnv(
    'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ),
} as const;

