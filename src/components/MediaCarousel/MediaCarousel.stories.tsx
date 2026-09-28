import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { expect, screen, userEvent, within } from "storybook/test"

import { landscapeImage, portraitImage, squareImage, wideImage } from "@/stories/fixtures/media"

import { MediaCarousel } from "."

const images = [landscapeImage, squareImage, portraitImage, wideImage].map((media, i) => ({
  id: `img-${i}`,
  media,
}))

const meta = {
  title: "Components/MediaCarousel",
  component: MediaCarousel,
  args: { images },
  decorators: [
    (Story) => (
      <div className="container max-w-3xl py-8">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof MediaCarousel>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const StartsOnThird: Story = {
  args: { initialIndex: 2 },
}

export const WithLightbox: Story = {
  args: { enableModal: true },
  play: async ({ canvasElement }) => {
    const slides = within(canvasElement).getAllByRole("group")
    await userEvent.click(within(slides[0]!).getByRole("button"))
    const dialog = await screen.findByRole("dialog")
    await expect(within(dialog).getByRole("img")).toHaveAttribute("alt", landscapeImage.alt)
  },
}
