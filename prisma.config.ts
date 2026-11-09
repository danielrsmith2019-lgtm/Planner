import { config } from "dotenv";
import { defineConfig } from "prisma/config";

// Prisma 7 doesn't load env files itself. Next.js keeps secrets in .env.local.
config({ path: ".env.local" });
config();

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  // CLI only (migrate, studio): Supabase session pooler, port 5432.
  // The app itself connects with DATABASE_URL in src/lib/db.ts.
  // Read with process.env (not env()) so `prisma generate` still works on a
  // machine or build server that has no database variables yet.
  datasource: { url: process.env.DIRECT_URL },
});
