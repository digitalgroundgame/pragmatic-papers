import react from "@vitejs/plugin-react"
import { defineConfig } from "vitest/config"

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
        resolve: {
          tsconfigPaths: true,
          // tsconfig maps "react" → @types/react for type-checking, but that package has
          // no runtime exports. Override it here so Vite resolves to the actual runtime package.
          alias: { react: path.resolve(__dirname, "node_modules/react") },
        },
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
    ],
  },
})
