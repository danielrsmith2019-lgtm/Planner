import "server-only";

import type { User } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { isValidTimeZone } from "@/lib/domain/dates";
import { ValidationError } from "./errors";

/**
 * The Prisma User that mirrors a Supabase auth user (User.authId = auth.users.id).
 *
 * Creating the User row is the one place the raw `prisma` client is used for
 * user data: there's no userId to scope by until this row exists.
 */

/** The parts of a Supabase auth user (or its JWT claims) that we need. */
export type AuthUserLike = {
  /** Supabase auth user id (auth.users.id, the JWT `sub`). */
  id: string;
  email?: string | null;
  user_metadata?: Record<string, unknown> | null;
};

export type UserDTO = {
  id: string;
  authId: string;
  email: string;
  name: string | null;
  timezone: string;
  dayStartsAt: number;
  morningRemindAt: number | null;
  eveningRemindAt: number | null;
};

export const DEFAULT_TIMEZONE = "America/New_York";

export function toUserDTO(user: User): UserDTO {
  return {
    id: user.id,
    authId: user.authId,
    email: user.email,
    name: user.name,
    timezone: user.timezone,
    dayStartsAt: user.dayStartsAt,
    morningRemindAt: user.morningRemindAt,
    eveningRemindAt: user.eveningRemindAt,
  };
}

/** Display name from email sign-up (display_name) or Google (full_name / name). */
function nameFrom(metadata: Record<string, unknown> | null | undefined): string | null {
  for (const key of ["display_name", "full_name", "name"]) {
    const value = metadata?.[key];
    if (typeof value === "string" && value.trim() !== "") return value.trim().slice(0, 120);
  }
  return null;
}

/**
 * Find or create the User for a signed-in Supabase user.
 *
 * - Timezone is set only when the row is created (later changes belong to
 *   settings, not to whichever device signed in last). An unknown zone falls
 *   back to America/New_York.
 * - Email and a missing name are kept in sync with Supabase on every call.
 * - If a row already has this email under a different authId (the Supabase
 *   account was deleted and recreated), it's relinked to the new authId so the
 *   person keeps their data. Supabase only issues sessions for confirmed
 *   emails (Google, or email with confirmation on), so the email is proven.
 */
export async function ensureUser(authUser: AuthUserLike, timezone: string | null | undefined): Promise<UserDTO> {
  const email = authUser.email?.trim().toLowerCase();
  if (!authUser.id) throw new ValidationError("authUser.id is required.");
  if (!email) throw new ValidationError("A signed-in user needs an email address.");
  const name = nameFrom(authUser.user_metadata);
  const zone = timezone && isValidTimeZone(timezone) ? timezone : DEFAULT_TIMEZONE;

  const user = await prisma.$transaction(async (tx) => {
    const byAuthId = await tx.user.findUnique({ where: { authId: authUser.id } });
    if (byAuthId !== null) {
      if (byAuthId.email === email && (byAuthId.name !== null || name === null)) return byAuthId;
      return tx.user.update({
        where: { id: byAuthId.id },
        data: { email, ...(byAuthId.name === null && name !== null ? { name } : {}) },
      });
    }

    const byEmail = await tx.user.findUnique({ where: { email } });
    if (byEmail !== null) {
      return tx.user.update({
        where: { id: byEmail.id },
        data: { authId: authUser.id, ...(byEmail.name === null && name !== null ? { name } : {}) },
      });
    }

    return tx.user.create({ data: { authId: authUser.id, email, name, timezone: zone } });
  });

  return toUserDTO(user);
}

export async function getUserByAuthId(authId: string): Promise<UserDTO | null> {
  const user = await prisma.user.findUnique({ where: { authId } });
  return user === null ? null : toUserDTO(user);
}
