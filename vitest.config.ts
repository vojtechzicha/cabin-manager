import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const src = fileURLToPath(new URL("./src", import.meta.url));
const payloadConfig = fileURLToPath(new URL("./src/payload.config.ts", import.meta.url));
const alias = { "@": src, "@payload-config": payloadConfig };

/**
 * Two test projects:
 *   unit        — pure domain / payments / i18n / lib logic. No DB, fast.
 *   integration — boots Payload against an ephemeral Mongo replica set (T-006).
 *
 * Run a single project with `vitest run --project unit` (see package.json).
 */
export default defineConfig({
  resolve: { alias },
  test: {
    projects: [
      {
        resolve: { alias },
        test: {
          name: "unit",
          environment: "node",
          include: [
            "src/domain/**/*.test.ts",
            "src/payments/**/*.test.ts",
            "src/i18n/**/*.test.ts",
            "src/lib/**/*.test.ts",
          ],
        },
      },
      {
        resolve: { alias },
        test: {
          name: "integration",
          environment: "node",
          include: ["tests/integration/**/*.test.ts"],
          globalSetup: ["tests/integration/global-setup.ts"],
          setupFiles: ["tests/integration/setup-env.ts"],
          // Payload instances are not safe to share across forks; one DB, one worker.
          pool: "forks",
          poolOptions: { forks: { singleFork: true } },
          hookTimeout: 120_000,
          testTimeout: 60_000,
        },
      },
    ],
  },
});
