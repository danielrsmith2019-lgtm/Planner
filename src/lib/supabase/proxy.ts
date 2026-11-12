import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isAuthPage, isPublicPath } from "@/lib/auth/paths";
import { supabaseEnv } from "./env";

/**
 * Runs on every page request (via src/proxy.ts):
 * 1. Refreshes the Supabase session and writes new cookies to the request (for
 *    Server Components) and to the response (for the browser).
 * 2. Sends signed-out visitors to /login?next=<where they were going>.
 * 3. Sends signed-in users away from /login and /signup.
 */
export async function updateSession(request: NextRequest) {
  const { url, publishableKey } = supabaseEnv();
  let response = NextResponse.next({ request });

  const supabase = createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
        // Responses that set auth cookies must never be cached and shared.
        for (const [key, value] of Object.entries(headers ?? {})) response.headers.set(key, value);
      },
    },
  });

  // Keep this call directly after createServerClient (Supabase's guidance):
  // it refreshes the token, and getClaims verifies the JWT signature.
  const { data } = await supabase.auth.getClaims();
  const signedIn = Boolean(data?.claims?.sub);
  const { pathname, search } = request.nextUrl;

  const redirectTo = (target: URL) => {
    const redirect = NextResponse.redirect(target);
    // Carry any refreshed session cookies across the redirect.
    for (const cookie of response.cookies.getAll()) redirect.cookies.set(cookie);
    return redirect;
  };

  if (!signedIn && !isPublicPath(pathname)) {
    const login = new URL("/login", request.url);
    if (pathname !== "/") login.searchParams.set("next", `${pathname}${search}`);
    return redirectTo(login);
  }

  if (signedIn && isAuthPage(pathname)) {
    return redirectTo(new URL("/", request.url));
  }

  return response;
}
