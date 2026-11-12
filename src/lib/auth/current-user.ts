import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { ensureUser, getUserByAuthId, type UserDTO } from "@/services/users";
import { TIMEZONE_COOKIE } from "./paths";

/**
 * The signed-in Prisma User, for Server Components and Server Actions.
 * Redirects to /login when nobody is signed in. Cached per request, so
 * calling it from several components costs one lookup.
 *
 * The first time a signed-in person has no User row (email/password sign-in
 * never passes through /auth/callback), the row is created here with the
 * browser's timezone from the planner-tz cookie.
 *
 * With cacheComponents on, render anything that calls this inside <Suspense>.
 */
export const getCurrentUser = cache(async (): Promise<UserDTO> => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) redirect("/login");

  const existing = await getUserByAuthId(claims.sub);
  if (existing !== null) return existing;

  const timezone = (await cookies()).get(TIMEZONE_COOKIE)?.value;
  return ensureUser(
    {
      id: claims.sub,
      email: typeof claims.email === "string" ? claims.email : null,
      user_metadata: (claims.user_metadata as Record<string, unknown> | undefined) ?? null,
    },
    timezone ? decodeURIComponent(timezone) : null,
  );
});
