import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { expect, within } from "storybook/test"

import { Breadcrumbs, nestedDocsTrail } from "."

const meta = {
  title: "Components/Breadcrumbs",
  component: Breadcrumbs,
} satisfies Meta<typeof Breadcrumbs>

export default meta
type Story = StoryObj<typeof meta>

export const Topic: Story = {
  args: {
    items: [
      { name: "Topics", path: "/topics" },
      { name: "Courts", path: "/topics/courts" },
    ],
  },
  play: async ({ canvasElement }) => {
    const nav = within(canvasElement).getByRole("navigation", { name: "breadcrumb" })
    await expect(within(nav).getByRole("link", { name: "Topics" })).toHaveAttribute(
      "href",
      "/topics",
    )
    await expect(within(nav).getByText("Courts")).toHaveAttribute("aria-current", "page")
  },
}

/** A page whose title has nothing to do with its slug: the trail shows the title. */
export const Page: Story = {
  args: { items: [{ name: "About the Papers", path: "/about" }] },
}

/** A nested document's trail, from the `breadcrumbs` field the nested-docs plugin keeps. */
export const Nested: Story = {
  args: {
    items: nestedDocsTrail([
      { label: "Policy", url: "/policy" },
      { label: "Health Care", url: "/policy/health" },
      { label: "Medicaid Expansion, State by State", url: "/policy/health/medicaid" },
    ]),
  },
  play: async ({ canvasElement }) => {
    const nav = within(canvasElement).getByRole("navigation", { name: "breadcrumb" })
    await expect(within(nav).getByRole("link", { name: "Health Care" })).toHaveAttribute(
      "href",
      "/policy/health",
    )
    await expect(within(nav).getByText("Medicaid Expansion, State by State")).toHaveAttribute(
      "aria-current",
      "page",
    )
  },
}

export const FullWidth: Story = {
  args: {
    fullWidth: true,
    items: [
      { name: "Interactives", path: "/interactives" },
      { name: "Federal Courts", path: "/interactives/federal-courts" },
    ],
  },
}

export const Empty: Story = {
  args: { items: [] },
  play: async ({ canvasElement }) => {
    await expect(canvasElement).toBeEmptyDOMElement()
  },
}
