import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const path = (relative: string) => fileURLToPath(new URL(relative, import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@": path("./src"),
      "server-only": path("./test/server-only-stub.ts"),
    },
  },
  test: {
    projects: [
      {
        extends: true,
        test: { name: "unit", include: ["src/lib/**/*.test.ts"] },
      },
      {
        extends: true,
        test: {
          name: "integration",
          include: ["src/services/**/*.test.ts", "prisma/**/*.test.ts"],
          setupFiles: ["./test/setup-db.ts"],
          testTimeout: 30_000,
          hookTimeout: 60_000,
        },
      },
    ],
  },
});
