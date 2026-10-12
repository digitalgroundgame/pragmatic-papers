import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { expect, within } from "storybook/test"

import { withPayloadAdminTheme } from "@/stories/payloadAdminTheme"

import { PluginsTable } from "./PluginsTable"

const meta = {
  title: "Admin/Plugins/PluginsTable",
  component: PluginsTable,
  decorators: [withPayloadAdminTheme],
  args: {
    plugins: [
      {
        name: "Search",
        source: "@payloadcms/plugin-search",
        description:
          "Keeps a search index of articles, pages, volumes and topics, which the site's search reads.",
        status: "on",
        stage: "stable",
        pages: [{ label: "Search", href: "/admin/collections/search" }],
      },
      {
        name: "Form builder",
        source: "@payloadcms/plugin-form-builder",
        description: "Forms and their submissions. Hidden in the admin until it's set up.",
        status: "on",
        stage: "stable",
        pages: [
          { label: "Forms", href: null },
          { label: "Form Submissions", href: null },
        ],
      },
      {
        name: "SEO",
        source: "@payloadcms/plugin-seo",
        description:
          "The Auto-generate buttons in the SEO tab of articles, pages, volumes, topics and interactives.",
        status: "on",
        stage: "stable",
        pages: [],
      },
      {
        name: "Help docs",
        source: "src/plugins/docs",
        description:
          "Help docs at /docs, written in the admin or shipped in src/docs/ with a release.",
        status: "off",
        stage: "beta",
        pages: [
          { label: "Docs", href: "/admin/collections/docs" },
          { label: "Settings → Experiments", href: "/admin/globals/site-settings" },
        ],
      },
      {
        name: "Guided tours",
        source: "src/plugins/tours",
        description: "driver.js walkthroughs of the admin.",
        status: "unknown",
        stage: "beta",
        pages: [{ label: "Settings → Experiments", href: "/admin/globals/site-settings" }],
      },
    ],
  },
} satisfies Meta<typeof PluginsTable>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const table = within(canvas.getByRole("table", { name: "Installed plugins" }))
    await expect(table.getByRole("row", { name: /Help docs/ })).toHaveTextContent("BetaOff")
    await expect(table.getByRole("row", { name: /Search/ })).toHaveTextContent("StableOn")
    await expect(table.getByRole("row", { name: /Guided tours/ })).toHaveTextContent(
      "Couldn't read",
    )
    await expect(table.getByRole("link", { name: "Docs" })).toHaveAttribute(
      "href",
      "/admin/collections/docs",
    )
    await expect(table.getByText("Forms (hidden)")).toBeInTheDocument()
    await expect(table.getByRole("row", { name: /SEO/ })).toHaveTextContent(
      "No settings in the admin",
    )
  },
}
