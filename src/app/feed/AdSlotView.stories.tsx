import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { expect, fn, userEvent, within } from "storybook/test"

import { phoneFrame } from "@/stories/fixtures/feed"

import { AdSlotView } from "./AdSlotView"
import { FEED_ADS } from "./ads/registry"

const [donation, external] = FEED_ADS

const meta = {
  title: "Feed/AdSlotView",
  component: AdSlotView,
  globals: { theme: "dark" },
  parameters: { layout: "centered" },
  decorators: [phoneFrame],
  // Paused, so the slot holds still instead of running its six-second timer.
  args: {
    ad: donation!,
    active: true,
    autoPlayEnabled: false,
    userAutoPlayEnabled: false,
    onAutoPlayToggle: fn(),
    onEndReached: fn(),
  },
} satisfies Meta<typeof AdSlotView>

export default meta
type Story = StoryObj<typeof meta>

export const Donation: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole("heading", { level: 2 })).toHaveTextContent(donation!.title)
    const cta = canvas.getByRole("link", { name: "Donate" })
    await expect(cta).toHaveAttribute("href", "/donate")
    await expect(cta).not.toHaveAttribute("target")
  },
}

/** An off-site link opens in a new tab, and says so with an arrow. */
export const External: Story = {
  args: { ad: external! },
  play: async ({ canvasElement }) => {
    const cta = within(canvasElement).getByRole("link", { name: "Visit Digital Ground Game" })
    await expect(cta).toHaveAttribute("target", "_blank")
    await expect(cta).toHaveAttribute("rel", expect.stringContaining("noopener"))
  },
}

/** Tapping the slot toggles auto-play; tapping its button doesn't. */
export const TapToToggle: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole("heading", { level: 2 }))
    await expect(args.onAutoPlayToggle).toHaveBeenCalledTimes(1)

    const stay = (event: MouseEvent): void => event.preventDefault()
    document.addEventListener("click", stay, { capture: true })
    try {
      await userEvent.click(canvas.getByRole("link", { name: "Donate" }))
    } finally {
      document.removeEventListener("click", stay, { capture: true })
    }
    await expect(args.onAutoPlayToggle).toHaveBeenCalledTimes(1)
  },
}
