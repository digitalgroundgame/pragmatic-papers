import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { useState } from "react"
import { expect, userEvent, within } from "storybook/test"

import { withPayloadAdminTheme } from "@/stories/payloadAdminTheme"

import { PluginSwitch } from "./PluginSwitch"
import { PluginsTable } from "./PluginsTable"

/** Stands in for `PluginSwitchField`, which needs Payload's form: the switch keeps its own state. */
function StorySwitchField({ name, path }: { name: string; path: string }): React.ReactNode {
  const [on, setOn] = useState(path === "switches.notifications")
  return <PluginSwitch name={name} checked={on} onCheckedChange={setOn} />
}

const meta = {
  title: "Admin/Plugins/PluginsTable",
  component: PluginsTable,
  decorators: [withPayloadAdminTheme],
  args: {
    SwitchField: StorySwitchField,
    plugins: [
      {
        name: "Search",
        source: "@payloadcms/plugin-search",
        description:
          "Keeps a search index of articles, pages, volumes and topics, which the site's search reads.",
        status: "on",
        beta: false,
        switchPath: null,
        pages: [{ label: "Search", href: "/admin/collections/search" }],
      },
      {
        name: "Form builder",
        source: "@payloadcms/plugin-form-builder",
        description: "Forms and their submissions. Hidden in the admin until it's set up.",
        status: "on",
        beta: false,
        switchPath: null,
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
        beta: false,
        switchPath: null,
        pages: [],
      },
      {
        name: "Help docs",
        source: "src/plugins/docs",
        description:
          "Help docs at /docs, written in the admin or shipped in src/docs/ with a release.",
        status: "off",
        beta: true,
        switchPath: "switches.docs",
        pages: [{ label: "Docs", href: "/admin/collections/docs" }],
      },
      {
        name: "Notifications",
        source: "src/plugins/notifications",
        description: "The bell in the admin header.",
        status: "on",
        beta: true,
        switchPath: "switches.notifications",
        pages: [],
      },
      {
        name: "Guided tours",
        source: "src/plugins/tours",
        description: "driver.js walkthroughs of the admin.",
        status: "unknown",
        beta: true,
        switchPath: null,
        pages: [],
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
    await expect(table.getByRole("row", { name: /Help docs/ })).toHaveTextContent("Help docsBeta")
    const docs = table.getByRole("switch", { name: "Help docs" })
    await expect(docs).not.toBeChecked()
    await userEvent.click(docs)
    await expect(docs).toBeChecked()
    await expect(table.getByRole("switch", { name: "Notifications" })).toBeChecked()
    const search = table.getByRole("switch", { name: "Search" })
    await expect(search).toBeChecked()
    await expect(search).toHaveAttribute("aria-disabled", "true")
    await expect(table.getByRole("row", { name: /Search/ })).not.toHaveTextContent("Beta")
    await expect(table.getByRole("row", { name: /Guided tours/ })).toHaveTextContent(
      "Couldn't read",
    )
    await expect(table.getByRole("link", { name: "Docs" })).toHaveAttribute(
      "href",
      "/admin/collections/docs",
    )
    await expect(table.getByText("Forms (hidden)")).toBeInTheDocument()
    await expect(table.getByRole("row", { name: /SEO/ })).toHaveTextContent("None")
  },
}
