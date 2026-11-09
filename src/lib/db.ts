import "server-only";

import { PrismaPg } from "@prisma/adapter-pg";
import { Prisma, PrismaClient } from "@/generated/prisma/client";

/**
 * The only place the app creates a Prisma client.
 *
 * Runtime uses DATABASE_URL (Supabase transaction pooler, port 6543) through
 * the pg driver adapter. Migrations use DIRECT_URL via prisma.config.ts.
 *
 * Services must call forUser(userId) and never use `prisma` directly for
 * user data. Prisma connects as a role that bypasses RLS, so forUser is the
 * real guard; RLS only protects the Supabase Data API.
 */

function createPrismaClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set. Add it to .env.local.");
  }
  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
}

// Reuse one client across hot reloads in development.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma: PrismaClient = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

// ---------------------------------------------------------------------------
// forUser
// ---------------------------------------------------------------------------

/** Models with their own userId column. */
const OWNED_MODELS = new Set<string>(["Goal", "Milestone", "Task", "JournalEntry", "ActivityEvent"]);

/** Operations whose args carry a `where` filter. */
const WHERE_OPS = new Set<string>([
  "findUnique",
  "findUniqueOrThrow",
  "findFirst",
  "findFirstOrThrow",
  "findMany",
  "count",
  "aggregate",
  "groupBy",
  "update",
  "updateMany",
  "updateManyAndReturn",
  "delete",
  "deleteMany",
  "upsert",
]);

const CREATE_OPS = new Set<string>(["create", "createMany", "createManyAndReturn"]);

type Args = Record<string, unknown>;

function isRecord(value: unknown): value is Args {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** AND the ownership filter onto whatever `where` the service passed. */
function scopeWhere(args: Args, scope: Args): Args {
  const where = isRecord(args.where) ? args.where : undefined;
  return { ...args, where: where ? { ...where, AND: [scope, ...(where.AND ? [where.AND] : [])] } : scope };
}

/** Stamp userId onto create payloads; reject a mismatched userId. */
function stampUserId(data: unknown, userId: string): unknown {
  if (Array.isArray(data)) return data.map((row) => stampUserId(row, userId));
  if (!isRecord(data)) return data;
  if (data.userId !== undefined && data.userId !== userId) {
    throw new Error("forUser: refusing to write a row for another user.");
  }
  if (isRecord(data.user)) {
    throw new Error("forUser: set ownership through forUser, not a nested `user` relation.");
  }
  return { ...data, userId };
}

/**
 * A Prisma client scoped to one user. Every read, update and delete on
 * user-owned models is filtered by userId, and every create is stamped with it.
 *
 *   const db = forUser(userId);
 *   const goals = await db.goal.findMany({ where: { status: "ACTIVE" } });
 *
 * Scoping by model:
 * - Goal, Milestone, Task, JournalEntry, ActivityEvent: by userId.
 * - User: only the user's own row (id = userId). Create Users with `prisma`
 *   during sign-up, never through forUser.
 * - JournalLink (no userId column): reads, updates and deletes are filtered
 *   through its entry. Creating links must go through a JournalEntry nested
 *   write (entry.update({ data: { links: { create } } })) so ownership is
 *   checked on the entry.
 *
 * Interactive transactions keep the scope:
 *   await forUser(userId).$transaction(async (tx) => { ... });
 */
export function forUser(userId: string) {
  if (!userId) throw new Error("forUser: userId is required.");

  return prisma.$extends({
    name: "forUser",
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          const input: Args = isRecord(args) ? args : {};
          let next: Args = input;

          if (model === "User") {
            if (CREATE_OPS.has(operation)) {
              throw new Error("forUser: create Users with `prisma` during sign-up.");
            }
            if (WHERE_OPS.has(operation)) next = scopeWhere(input, { id: userId });
          } else if (model === "JournalLink") {
            if (CREATE_OPS.has(operation)) {
              throw new Error("forUser: create JournalLinks through a JournalEntry nested write.");
            }
            if (WHERE_OPS.has(operation)) next = scopeWhere(input, { entry: { userId } });
          } else if (OWNED_MODELS.has(model)) {
            if (WHERE_OPS.has(operation)) next = scopeWhere(next, { userId });
            if (CREATE_OPS.has(operation)) next = { ...next, data: stampUserId(next.data, userId) };
            if (operation === "upsert") next = { ...next, create: stampUserId(next.create, userId) };
          }

          return query(next as typeof args);
        },
      },
    },
  });
}

export type UserScopedDb = ReturnType<typeof forUser>;
export { Prisma };
