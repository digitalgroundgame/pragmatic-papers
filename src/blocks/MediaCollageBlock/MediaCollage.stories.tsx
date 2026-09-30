import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { expect, screen, userEvent, waitFor, within } from "storybook/test"

import { mediaFixture, portraitImage, squareImage, wideImage } from "@/stories/fixtures/media"
import {
  createLinkNode,
  createParagraph,
  createTextNode,
  richText,
} from "@/stories/fixtures/richText"

import { MediaCollageBlock } from "./component"

// The first image carries a caption with a link: the grid hides captions, the
// lightbox shows them.
const captionedLandscape = mediaFixture({
  caption: richText(
    createParagraph([
      createTextNode("The ridge above town. Photo: "),
      createLinkNode("County Archive", "https://example.com/archive"),
    ]),
  ),
})

const images = [captionedLandscape, squareImage, portraitImage, wideImage].map((media, i) => ({
  id: `img-${i}`,
  media,
}))

const meta = {
  title: "Blocks/MediaCollage",
  component: MediaCollageBlock,
  args: { blockType: "mediaCollage", layout: "grid", images },
  argTypes: {
    layout: { control: "inline-radio", options: ["grid", "carousel"] },
  },
  decorators: [
    (Story) => (
      <div className="container max-w-3xl py-8">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof MediaCollageBlock>

export default meta
type Story = StoryObj<typeof meta>

export const Grid: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const triggers = canvas.getAllByRole("button")
    await expect(triggers).toHaveLength(images.length)
    // Captions stay out of the grid, and never end up inside a trigger.
    await expect(
      canvas.getByRole("link", { name: "County Archive", hidden: true }),
    ).not.toBeVisible()
    for (const trigger of triggers) {
      await expect(within(trigger).queryByRole("link")).not.toBeInTheDocument()
    }

    await userEvent.click(triggers[0]!)
    const dialog = await screen.findByRole("dialog")
    await expect(within(dialog).getByRole("img")).toHaveAttribute("alt", captionedLandscape.alt)
    // The dialog fades in, so wait for its caption to become visible.
    await waitFor(() =>
      expect(within(dialog).getByRole("link", { name: "County Archive" })).toBeVisible(),
    )
  },
}

export const OddCount: Story = {
  args: { images: images.slice(0, 3) },
}

export const Carousel: Story = {
  args: { layout: "carousel" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const second = await canvas.findByRole("button", { name: "Go to slide 2" })
    // Next stays disabled until the carousel has measured its slides.
    const next = canvas.getByRole("button", { name: "Next slide" })
    await waitFor(() => expect(next).toBeEnabled())
    await userEvent.click(next)
    await waitFor(() => expect(second).toHaveClass("bg-primary"))
  },
}
