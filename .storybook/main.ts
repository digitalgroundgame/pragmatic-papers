import type { StorybookConfig } from "@storybook/nextjs-vite"
import path from "node:path"
import { fileURLToPath } from "node:url"
import type { Plugin } from "vite"

const dirname = path.dirname(fileURLToPath(import.meta.url))
const payloadClient = path.resolve(dirname, "../src/data/payload.ts")
const payloadClientMock = path.resolve(dirname, "../src/stories/mocks/payload.ts")

/**
 * Every Payload query goes through getPayloadClient (`@/data/payload`); Storybook gets the
 * in-memory stand-in instead. Swapping it at resolve time, rather than with
 * `sb.mock`, also keeps Vite's dependency scan out of the Payload config and
 * the Node-only packages behind it.
 */
function mockPayload(): Plugin {
  return {
    name: "storybook-mock-payload",
    enforce: "pre",
    async resolveId(source, importer, options) {
      if (!source.endsWith("data/payload") || importer === payloadClientMock) return null
      const resolved = await this.resolve(source, importer, { ...options, skipSelf: true })
      return resolved?.id === payloadClient ? payloadClientMock : null
    },
  }
}

/**
 * Server env the stories need. The built preview swaps `process.env` for an
 * empty object wherever it's read, so a story can't set one in `beforeEach`;
 * `define` bakes it in for the dev server, the build and the test runner alike.
 */
const storyEnv = {
  MERCH_SITE_URL: "https://shop.example.com/collections/pragmatic-papers",
}

const config: StorybookConfig = {
  stories: ["../src/**/*.stories.@(ts|tsx)", "../src/**/*.mdx"],
  addons: [
    "@storybook/addon-docs",
    "@storybook/addon-a11y",
    "@storybook/addon-themes",
    "@storybook/addon-vitest",
  ],
  framework: {
    name: "@storybook/nextjs-vite",
    options: {},
  },
  staticDirs: [
    "../public",
    { from: "./assets", to: "/storybook-assets" },
    { from: "../src/endpoints/seed/fixtures", to: "/seed-fixtures" },
  ],
  core: {
    disableTelemetry: true,
  },
  features: {
    experimentalRSC: true,
  },
  viteFinal: (viteConfig) => {
    viteConfig.plugins = [mockPayload(), ...(viteConfig.plugins ?? [])]
    viteConfig.define = {
      ...viteConfig.define,
      ...Object.fromEntries(
        Object.entries(storyEnv).map(([key, value]) => [
          `process.env.${key}`,
          JSON.stringify(value),
        ]),
      ),
    }
    return viteConfig
  },
}

export default config
