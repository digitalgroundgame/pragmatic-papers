import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { expect, mocked, screen, userEvent, waitFor, within } from "storybook/test"

import { createFakePayload } from "@/stories/fixtures/payload"
import { navItems, socials } from "@/stories/fixtures/navigation"
import { getPayloadConfig } from "@/utilities/getPayloadConfig"

import { Header } from "./Component"

/** Seeds the fake Payload; `feed` switches the feed experiment in Settings. */
function seedPayload({ feed = false }: { feed?: boolean } = {}): void {
  mocked(getPayloadConfig).mockResolvedValue(
    createFakePayload({
      globals: {
        header: {
          navItems,
          // The seeded header's actions (src/endpoints/seed/menus.ts).
          actions: [
            {
              id: "a1",
              link: {
                type: "custom",
                url: "https://example.com/donate",
                label: "Donate",
                newTab: true,
                variant: "branded",
              },
            },
            {
              id: "a2",
              link: {
                type: "custom",
                url: "https://discord.gg/digitalgroundgame",
                label: "Join Us",
                newTab: true,
                variant: "outline",
              },
            },
          ],
        },
        footer: { socials },
        "site-settings": { experiments: { feed } },
      },
    }),
  )
}

const meta = {
  title: "Layout/Header",
  component: Header,
  parameters: { layout: "fullscreen", nextjs: { navigation: { pathname: "/articles" } } },
  beforeEach: () => seedPayload(),
} satisfies Meta<typeof Header>

export default meta
type Story = StoryObj<typeof meta>

export const Desktop: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByRole("link", { name: "Link to Home" })).toHaveAttribute(
      "href",
      "/",
    )
    await expect(canvas.getByRole("link", { name: /Donate/ })).toBeVisible()
    await expect(canvas.getByRole("link", { name: /Join Us/ })).toBeVisible()
    // The feed experiment is off by default, so there's no way into it.
    await expect(canvas.queryByRole("link", { name: "Feed" })).not.toBeInTheDocument()
  },
}

export const FeedExperimentOn: Story = {
  // The docs page renders every story at once against one fake Payload, so this
  // story's seed would put the feed button in every other story there too.
  tags: ["!autodocs"],
  beforeEach: () => seedPayload({ feed: true }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByRole("link", { name: "Feed" })).toHaveAttribute("href", "/feed")
  },
}

export const MenuOpen: Story = {
  play: async ({ canvasElement }) => {
    await userEvent.click(await within(canvasElement).findByRole("button", { name: "Menu" }))
    const sheet = await screen.findByRole("dialog")
    await expect(within(sheet).getByRole("searchbox", { name: "Search box" })).toBeInTheDocument()
    const current = within(sheet).getByRole("link", { name: "Articles" })
    await expect(current).toHaveAttribute("aria-current", "page")
    await expect(current.closest("button")).not.toBeInTheDocument()
  },
}

export const MenuClosesOnLinkClick: Story = {
  play: async ({ canvasElement }) => {
    // Keep the story on its page; the menu's own click handler still runs.
    const stay = (event: MouseEvent): void => event.preventDefault()
    document.addEventListener("click", stay, { capture: true })
    try {
      await userEvent.click(await within(canvasElement).findByRole("button", { name: "Menu" }))
      const sheet = await screen.findByRole("dialog")
      await userEvent.click(within(sheet).getByRole("link", { name: "Topics" }))
      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
    } finally {
      document.removeEventListener("click", stay, { capture: true })
    }
  },
}

export const Mobile: Story = {
  globals: { viewport: { value: "mobile1", isRotated: false } },
}

/** The mega menu's links are in the markup before it loads, and keep focus once it has. */
export const MegaMenuByKeyboard: Story = {
  play: async ({ canvasElement }) => {
    const nav = await within(canvasElement).findByRole("navigation", { name: "Main" })
    const first = within(nav).getAllByRole("link")[0]!
    const name = first.textContent ?? ""
    first.focus()
    await waitFor(() => expect(first).not.toBeInTheDocument())
    const live = within(within(canvasElement).getByRole("navigation", { name: "Main" })).getByRole(
      "link",
      { name },
    )
    await expect(live).toHaveFocus()
  },
}
