/**
 * Supabase project settings. Both values are public by design (they ship to
 * the browser); data is protected by RLS and by forUser on the server.
 * Read with literal process.env names so Next.js can inline them into client code.
 */
export function supabaseEnv(): { url: string; publishableKey: string } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !publishableKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY must be set in .env.local.",
    );
  }
  return { url, publishableKey };
}
