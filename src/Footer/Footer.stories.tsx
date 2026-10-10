import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { expect, mocked, within } from "storybook/test"

import { createFakePayload } from "@/stories/fixtures/payload"
import { navItems, socials } from "@/stories/fixtures/navigation"
import { paragraphs } from "@/stories/fixtures/richText"
import { getPayloadClient } from "@/data/payload"

import { Footer } from "./Component"

const footer = {
  navItems,
  socials,
  copyright: { type: "custom", url: "https://digitalgroundgame.org", label: "Digital Ground Game" },
}

function withFooter(overrides: Record<string, unknown> = {}) {
  return () => {
    mocked(getPayloadClient).mockResolvedValue(
      createFakePayload({ globals: { footer: { ...footer, ...overrides } } }),
    )
  }
}

const meta = {
  title: "Layout/Footer",
  component: Footer,
  parameters: { layout: "fullscreen" },
  beforeEach: withFooter(),
} satisfies Meta<typeof Footer>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(
      await canvas.findByRole("navigation", { name: "Footer Social Links" }),
    ).toBeInTheDocument()
    await expect(canvas.getByRole("link", { name: /Digital Ground Game/ })).toHaveTextContent(
      String(new Date().getFullYear()),
    )
  },
}

export const WithLayout: Story = {
  beforeEach: withFooter({
    layout: [
      {
        blockType: "content",
        id: "footer-content",
        width: "full",
        columns: [
          { id: "c1", size: "half", richText: paragraphs(1) },
          { id: "c2", size: "half", richText: paragraphs(2) },
        ],
      },
    ],
  }),
  play: async ({ canvasElement }) => {
    const contentinfo = await within(canvasElement).findByRole("contentinfo")
    const section = contentinfo.querySelector("section")
    // The footer pads its content once, so the columns line up with the logo below.
    await expect(section).toHaveStyle({ paddingLeft: "0px", paddingRight: "0px" })
  },
}
