import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { expect, screen, userEvent, waitFor, within } from "storybook/test"

import {
  landscapeImage,
  mediaFixture,
  portraitImage,
  squareImage,
  wideImage,
} from "@/stories/fixtures/media"
import {
  createLinkNode,
  createParagraph,
  createTextNode,
  richText,
} from "@/stories/fixtures/richText"

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

const captionedLandscape = mediaFixture({
  caption: richText(
    createParagraph([
      createTextNode("The ridge above town. Photo: "),
      createLinkNode("County Archive", "https://example.com/archive"),
    ]),
  ),
})

export const WithLightbox: Story = {
  args: { enableModal: true, images: [{ id: "captioned", media: captionedLandscape }, ...images] },
  play: async ({ canvasElement }) => {
    const slides = within(canvasElement).getAllByRole("group")
    const trigger = within(slides[0]!).getByRole("button")
    // The slide hides its caption; the trigger holds only the image.
    await expect(within(trigger).getByRole("img")).toHaveAttribute("alt", captionedLandscape.alt)
    await expect(within(trigger).queryByRole("link")).not.toBeInTheDocument()

    await userEvent.click(trigger)
    const dialog = await screen.findByRole("dialog")
    await expect(within(dialog).getByRole("img")).toHaveAttribute("alt", captionedLandscape.alt)
    // The dialog fades in, so wait for its caption to become visible.
    await waitFor(() =>
      expect(within(dialog).getByRole("link", { name: "County Archive" })).toBeVisible(),
    )
  },
}
