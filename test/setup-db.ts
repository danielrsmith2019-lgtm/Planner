/**
 * Integration test database: real Postgres (PGlite, WebAssembly) in-process.
 * Applies every migration in prisma/migrations, exposes it over the Postgres
 * wire protocol, and points DATABASE_URL at it before src/lib/db.ts loads.
 * Each test starts from empty tables. Nothing here touches Supabase.
 */
import { readdirSync, readFileSync } from "node:fs";
import { createServer } from "node:net";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import { afterAll, beforeEach } from "vitest";

const MIGRATIONS_DIR = join(process.cwd(), "prisma", "migrations");
const APP_TABLES = ["ActivityEvent", "JournalLink", "JournalEntry", "Task", "Milestone", "Goal", "User"];

async function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const probe = createServer();
    probe.once("error", reject);
    probe.listen(0, "127.0.0.1", () => {
      const address = probe.address();
      const port = typeof address === "object" && address !== null ? address.port : 0;
      probe.close(() => resolve(port));
    });
  });
}

const pglite = await PGlite.create();

const migrations = readdirSync(MIGRATIONS_DIR, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();
for (const name of migrations) {
  await pglite.exec(readFileSync(join(MIGRATIONS_DIR, name, "migration.sql"), "utf8"));
}

const port = await freePort();
// PGlite is one database session; extra pool connections share it with
// queries queued one at a time, which is fine for sequential tests.
const server = new PGLiteSocketServer({ db: pglite, port, host: "127.0.0.1", maxConnections: 10 });
await server.start();

process.env.DATABASE_URL = `postgresql://postgres:postgres@127.0.0.1:${port}/postgres`;

beforeEach(async () => {
  await pglite.exec(`TRUNCATE ${APP_TABLES.map((t) => `"${t}"`).join(", ")} CASCADE;`);
});

afterAll(async () => {
  const { prisma } = await import("@/lib/db");
  await prisma.$disconnect();
  await server.stop();
  await pglite.close();
});
