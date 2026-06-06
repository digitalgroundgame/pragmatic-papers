import { defineConfig, devices } from "@playwright/test"
import dotenv from "dotenv"

dotenv.config()

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "html",
  snapshotPathTemplate: "{testDir}/__screenshots__/{testFilePath}/{arg}{ext}",
  expect: {
    toHaveScreenshot: {
      maxDiffPixelRatio: 0.01,
      animations: "disabled",
      caret: "hide",
    },
  },
  use: {
    baseURL: "http://localhost:8000",
    trace: "on-first-retry",
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
    url: process.env.NEXT_PUBLIC_SERVER_URL || "http://localhost:8000",
    reuseExistingServer: !!process.env.E2E_MANAGED_SERVER || !process.env.CI,
    timeout: 120_000,
  },
})
