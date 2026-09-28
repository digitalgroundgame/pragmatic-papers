import { storybookTest } from "@storybook/addon-vitest/vitest-plugin"
import react from "@vitejs/plugin-react"
import { playwright } from "@vitest/browser-playwright"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { defineConfig } from "vitest/config"

const dirname = path.dirname(fileURLToPath(import.meta.url))

// Pin the timezone so date rendering is reproducible. Anything that formats a
// date for display (`formatDateTime`, and the snapshots that capture it) reads
// the host timezone, so a snapshot generated in America/Los_Angeles records
// "May 31" for a UTC-midnight timestamp that CI — which runs in UTC — renders
// as "June 1". Setting it here rather than in the test scripts covers every
// entry point, including direct `vitest` runs and IDE test runners.
process.env.TZ = "UTC"

export default defineConfig({
  test: {
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "json-summary", "lcov"],
      // Instrument the whole source tree so the "total" reflects the real project
      // coverage. Without `include`, Vitest 4 only reports files imported during the
      // run (the handful the tests touch), making the total read like patch coverage.
      include: ["src/**/*.{ts,tsx}", "scripts/**/*.ts"],
      exclude: [
        "**/__tests__/**",
        "**/*.{test,spec}.{ts,tsx}",
        "**/*.stories.{ts,tsx}",
        "src/stories/**",
        "**/*.d.ts",
        "src/migrations/**",
        "src/payload-types.ts",
        "src/app/(payload)/**",
        "src/payload.config.ts",
        "src/instrumentation.ts",
        "src/instrumentation-client.ts",
        "src/proxy.ts",
        "**/*.config.{ts,mts,js,mjs,cjs}",
        "tests/**",
      ],
    },
    projects: [
      {
        plugins: [react()],
        resolve: { tsconfigPaths: true },
        test: {
          name: "unit",
          environment: "jsdom",
          include: ["src/**/__tests__/**/*.test.{ts,tsx}"],
          setupFiles: ["./vitest.setup.ts"],
        },
      },
      {
        resolve: { tsconfigPaths: true },
        test: {
          name: "integration",
          environment: "node",
          include: ["tests/integration/**/*.test.ts"],
          setupFiles: ["./vitest.setup.ts", "./tests/setup/integration-db-setup.ts"],
          globalSetup: ["./tests/setup/integration-global-setup.ts"],
          hookTimeout: 30_000,
          testTimeout: 60_000,
        },
      },
      {
        resolve: { tsconfigPaths: true },
        test: {
          name: "scripts",
          environment: "node",
          include: ["tests/scripts/**/*.test.ts"],
        },
      },
      {
        plugins: [storybookTest({ configDir: path.join(dirname, ".storybook") })],
        // Crawl every story up front: a dependency Vite discovers mid-run reloads the
        // browser and fails every test file in flight.
        optimizeDeps: { entries: [".storybook/preview.tsx", "src/**/*.stories.tsx"] },
        test: {
          name: "storybook",
          browser: {
            enabled: true,
            headless: true,
            // Stories click through `userEvent`, which isn't a user gesture to
            // Chromium, so media would otherwise refuse to play.
            provider: playwright({
              launchOptions: { args: ["--autoplay-policy=no-user-gesture-required"] },
            }),
            instances: [{ browser: "chromium" }],
            viewport: { width: 1280, height: 800 },
          },
        },
      },
    ],
  },
})
