import "server-only";

import { unstable_rethrow } from "next/navigation";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/current-user";
import { NotFoundError, StaleEntryError, ValidationError } from "@/services/errors";
import type { UserDTO } from "@/services/users";
import type { ActionResult } from "./types";

/**
 * The wrapper every Server Action goes through:
 *
 * 1. getCurrentUser() first. Not signed in -> redirect("/login"), which is
 *    re-thrown untouched so Next can handle it.
 * 2. Parse the input with the action's Zod schema. Never trust the client.
 * 3. Run the service with the user's id.
 * 4. Map the service's deliberate errors to { ok: false, error }. Anything
 *    else (a Prisma error, a bug) is logged on the server and the client gets
 *    a generic INTERNAL error, so no SQL or table names leak to the browser.
 *
 * Not a "use server" file: only the files in src/actions that call this are.
 */
export async function runAction<S extends z.ZodType, T>(
  schema: S,
  input: unknown,
  fn: (user: UserDTO, data: z.output<S>) => Promise<T>,
): Promise<ActionResult<T>> {
  try {
    const user = await getCurrentUser();
    const parsed = schema.safeParse(input);
    if (!parsed.success) {
      const flat = z.flattenError(parsed.error);
      return {
        ok: false,
        error: {
          code: "VALIDATION",
          message: flat.formErrors[0] ?? "Some fields are invalid.",
          fieldErrors: flat.fieldErrors as Record<string, string[]>,
        },
      };
    }
    return { ok: true, data: await fn(user, parsed.data) };
  } catch (error) {
    unstable_rethrow(error);
    return { ok: false, error: toActionError(error) };
  }
}

function toActionError(error: unknown): Extract<ActionResult<never>, { ok: false }>["error"] {
  if (error instanceof ValidationError) return { code: "VALIDATION", message: error.message };
  if (error instanceof NotFoundError) return { code: "NOT_FOUND", message: "That item no longer exists." };
  if (error instanceof StaleEntryError) {
    return {
      code: "STALE",
      message: "This entry changed somewhere else. Reload to see the latest.",
      currentVersion: error.currentVersion,
    };
  }
  console.error("[action] unexpected error", error);
  return { code: "INTERNAL", message: "Something went wrong. Try again." };
}
