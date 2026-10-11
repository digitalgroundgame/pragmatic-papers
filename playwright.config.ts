import { defineConfig, devices } from "@playwright/test"
import dotenv from "dotenv"

dotenv.config()

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  // Every spec only reads the seed (nothing signs up, saves or deletes), so tests can share
  // the database and run in any order. CI's runner has 4 vCPUs shared by the browsers, the
  // single Next.js server under test and Postgres: two workers keep the server from becoming
  // what a timing-sensitive test (the drilldown's camera, the meta row's geometry) waits on.
  workers: process.env.CI ? 2 : undefined,
  // `list` prints each test's duration in the job log, where the HTML report needs downloading.
  reporter: process.env.CI ? [["list"], ["html"]] : "html",
  use: {
    // Same source as `webServer.url` below, so a server managed outside the runner
    // (`E2E_MANAGED_SERVER`) can live on another port and still be the one under test.
    baseURL: process.env.SERVER_URL || "http://localhost:8000",
    trace: "on-first-retry",
    // Pin what dates, numbers and themes render with, so assertions on them hold everywhere.
    timezoneId: "UTC",
    locale: "en-US",
    colorScheme: "light",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    ...(process.env.E2E_ALL_BROWSERS
      ? [
          {
            name: "firefox",
            use: { ...devices["Desktop Firefox"] },
          },
          {
            name: "webkit",
            use: { ...devices["Desktop Safari"] },
          },
          /* Mobile viewports. */
          {
            name: "Mobile Chrome",
            use: { ...devices["Pixel 5"] },
          },
          {
            name: "Mobile Safari",
            use: { ...devices["iPhone 12"] },
          },

          /* Tablet viewport. */
          {
            name: "Tablet",
            use: { ...devices["iPad (gen 7)"] },
          },

          /* Test against branded browsers. */
          // {
          //   name: 'Microsoft Edge',
          //   use: { ...devices['Desktop Edge'], channel: 'msedge' },
          // },
          // {
          //   name: 'Google Chrome',
          //   use: { ...devices['Desktop Chrome'], channel: 'chrome' },
          // },
        ]
      : []),
  ],
  webServer: {
    command: process.env.E2E_MANAGED_SERVER ? "echo 'server managed externally'" : "pnpm dev:next",
    url: process.env.SERVER_URL || "http://localhost:8000",
    reuseExistingServer: !!process.env.E2E_MANAGED_SERVER || !process.env.CI,
    timeout: 120_000,
  },
})
