/**
 * Route rules for authentication. Pure, so the proxy, pages and tests share
 * one definition.
 */

/** Paths a signed-out visitor may open. Everything else redirects to /login. */
export const PUBLIC_PATHS = ["/login", "/signup", "/auth/callback"] as const;

/** Signed-in users who open these are sent into the app instead. */
export const AUTH_PAGES = ["/login", "/signup"] as const;

/** Cookie the browser sets with its IANA timezone (see TimezoneSync). */
export const TIMEZONE_COOKIE = "planner-tz";

function normalize(pathname: string): string {
  return pathname.length > 1 && pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
}

export function isPublicPath(pathname: string): boolean {
  return (PUBLIC_PATHS as readonly string[]).includes(normalize(pathname));
}

export function isAuthPage(pathname: string): boolean {
  return (AUTH_PAGES as readonly string[]).includes(normalize(pathname));
}

/**
 * Where to send someone after signing in. Only same-site absolute paths are
 * allowed, so ?next= can't be used to bounce users to another website, and
 * auth pages fall back to "/" to avoid redirect loops.
 */
export function safeNextPath(raw: string | null | undefined): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//") || raw.includes("\\")) return "/";
  try {
    const url = new URL(raw, "http://planner.local");
    if (url.origin !== "http://planner.local") return "/";
    if (isAuthPage(url.pathname) || url.pathname.startsWith("/auth/")) return "/";
    return `${url.pathname}${url.search}`;
  } catch {
    return "/";
  }
}
