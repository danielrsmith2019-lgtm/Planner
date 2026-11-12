import { NextResponse, type NextRequest } from "next/server";
import { safeNextPath, TIMEZONE_COOKIE } from "@/lib/auth/paths";
import { createClient } from "@/lib/supabase/server";
import { ensureUser } from "@/services/users";

/**
 * Where Supabase sends the browser after Google sign-in or an email
 * confirmation link. Exchanges the one-time code for a session, makes sure the
 * Prisma User exists (with the browser's timezone), then continues to ?next=.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const next = safeNextPath(searchParams.get("next"));

  const fail = (reason: string) => {
    const login = new URL("/login", origin);
    login.searchParams.set("error", reason);
    return NextResponse.redirect(login);
  };

  const providerError = searchParams.get("error_description") ?? searchParams.get("error");
  if (providerError) return fail(providerError);
  if (!code) return fail("The sign-in link is missing its code. Please try again.");

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.user) return fail(error?.message ?? "Sign-in failed. Please try again.");

  const timezone = request.cookies.get(TIMEZONE_COOKIE)?.value;
  await ensureUser(data.user, timezone ? decodeURIComponent(timezone) : null);

  return NextResponse.redirect(new URL(next, origin));
}
