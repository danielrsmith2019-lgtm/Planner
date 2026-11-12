import { createBrowserClient } from "@supabase/ssr";
import { supabaseEnv } from "./env";

/**
 * Supabase client for Client Components (sign in, sign up, OAuth redirects).
 * Create it inside event handlers, not during render, so pages can prerender.
 */
export function createClient() {
  const { url, publishableKey } = supabaseEnv();
  return createBrowserClient(url, publishableKey);
}
