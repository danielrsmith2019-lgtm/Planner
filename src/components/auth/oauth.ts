import { createClient } from "@/lib/supabase/client";

/** Start Google sign-in; Supabase brings the browser back to /auth/callback. */
export async function signInWithGoogle(next: string): Promise<string | null> {
  const supabase = createClient();
  const callback = new URL("/auth/callback", window.location.origin);
  if (next !== "/") callback.searchParams.set("next", next);
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: callback.toString() },
  });
  return error?.message ?? null;
}
