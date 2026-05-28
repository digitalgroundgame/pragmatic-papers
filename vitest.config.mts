import react from "@vitejs/plugin-react"
import path from "path"
import { fileURLToPath } from "url"
import { defineConfig } from "vitest/config"

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  test: {
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
        resolve: {
          tsconfigPaths: true,
          // tsconfig maps "react" → @types/react for type-checking, but that package has
          // no runtime exports. Override it here so Vite resolves to the actual runtime package.
          alias: { react: path.resolve(__dirname, "node_modules/react") },
        },
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
