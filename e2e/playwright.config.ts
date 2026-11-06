import { defineConfig, devices } from "@playwright/test";

const DEMO_PORT = 5173;
const baseURL = process.env.BASE_URL || `http://localhost:${DEMO_PORT}`;

export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [["html"], ["allure-playwright"]],
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: process.env.BASE_URL
    ? undefined
    : {
        command: "node ../web/dev-server.mjs",
        url: baseURL,
        env: { PORT: String(DEMO_PORT) },
        reuseExistingServer: !process.env.CI,
      },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
