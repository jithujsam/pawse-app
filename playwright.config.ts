import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;

export default defineConfig({
  testDir: "e2e",
  timeout: 300_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  workers: 1,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
    ...devices["Desktop Chrome"],
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH } : undefined,
  },
  webServer: {
    // Dev server on a fresh embedded database, with every provider mocked.
    command: `rm -rf .data/e2e && npx next dev -p ${PORT}`,
    url: `http://localhost:${PORT}/api/health`,
    timeout: 180_000,
    reuseExistingServer: false,
    env: {
      PGLITE_DIR: ".data/e2e",
      APP_URL: `http://localhost:${PORT}`,
      WHATSAPP_PROVIDER: "mock",
      PAYMENT_PROVIDER: "mock",
      SCORER_PROVIDER: "mock",
      MAILER_PROVIDER: "console",
      DEMO_MODE: "true",
    },
  },
});
