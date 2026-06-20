import { defineConfig, devices } from "@playwright/test";

/**
 * E2e smoke + visual capture. Requires the local Mongo replica set
 * (`pnpm mongo:up`); the webServer boots the app. Run with `pnpm test:e2e`.
 */
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  use: {
    baseURL: "http://localhost:3000",
    trace: "off",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "pnpm dev",
    url: "http://localhost:3000/healthz",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
