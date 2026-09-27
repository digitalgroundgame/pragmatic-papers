import type { StorybookConfig } from "@storybook/nextjs-vite"

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
}

export default config
