/**
 * Seeds demo data into the database in .env.local.
 *
 *   npx prisma db seed
 *
 * Optional: SEED_EMAIL and SEED_AUTH_ID attach the data to a real account
 * (e.g. your own, once sign-in exists). Re-running replaces only that user's data.
 * SEED_NAME and SEED_TIMEZONE keep your name and timezone (defaults: "Demo",
 * America/New_York), since the user row is recreated.
 */
import { config } from "dotenv";

config({ path: ".env.local" });
config();

async function main() {
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_PRODUCTION_SEED !== "true") {
    throw new Error("Refusing to seed with NODE_ENV=production. Set ALLOW_PRODUCTION_SEED=true to override.");
  }
  // Imported after dotenv so src/lib/db.ts sees DATABASE_URL.
  const { seedDemo } = await import("./seed-data");
  const { prisma } = await import("@/lib/db");
  try {
    const summary = await seedDemo({
      email: process.env.SEED_EMAIL || undefined,
      authId: process.env.SEED_AUTH_ID || undefined,
      name: process.env.SEED_NAME || undefined,
      timezone: process.env.SEED_TIMEZONE || undefined,
    });
    console.log("Seeded demo data:");
    console.table(summary);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
