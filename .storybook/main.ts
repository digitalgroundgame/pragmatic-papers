import type { StorybookConfig } from "@storybook/nextjs-vite"
import path from "node:path"
import { fileURLToPath } from "node:url"
import type { Plugin } from "vite"

const dirname = path.dirname(fileURLToPath(import.meta.url))
const payloadConfig = path.resolve(dirname, "../src/utilities/getPayloadConfig.ts")
const payloadConfigMock = path.resolve(dirname, "../src/utilities/__mocks__/getPayloadConfig.ts")

/**
 * Every Payload query goes through getPayloadConfig; Storybook gets the
 * in-memory stand-in instead. Swapping it at resolve time, rather than with
 * `sb.mock`, also keeps Vite's dependency scan out of the Payload config and
 * the Node-only packages behind it.
 */
function mockPayload(): Plugin {
  return {
    name: "storybook-mock-payload",
    enforce: "pre",
    async resolveId(source, importer, options) {
      if (!source.includes("getPayloadConfig") || importer === payloadConfigMock) return null
      const resolved = await this.resolve(source, importer, { ...options, skipSelf: true })
      return resolved?.id === payloadConfig ? payloadConfigMock : null
    },
  }
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
    return viteConfig
  },
}

export default config
