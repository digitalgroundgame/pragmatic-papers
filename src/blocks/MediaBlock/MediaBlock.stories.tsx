import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { expect, screen, userEvent, within } from "storybook/test"

import { FeedHTML } from "@/stories/FeedHTML"
import { captionedImage } from "@/stories/fixtures/blocks"
import { storyFeedContext } from "@/stories/fixtures/feedContext"
import { landscapeImage, portraitImage } from "@/stories/fixtures/media"

import { MediaBlock } from "./Component"
import { mediaBlockToHTML } from "./converters"
import { LightboxMediaBlock } from "./LightboxMediaBlock"

const captioned = captionedImage

const meta = {
  title: "Blocks/MediaBlock",
  component: MediaBlock,
  args: { media: landscapeImage },
} satisfies Meta<typeof MediaBlock>

export default meta
type Story = StoryObj<typeof meta>

export const Image: Story = {}

export const WithCaption: Story = {
  args: { media: captioned },
  play: async ({ canvasElement }) => {
    const figure = within(canvasElement).getByRole("figure")
    await expect(within(figure).getByRole("link", { name: "County Archive" })).toBeInTheDocument()
  },
}

export const Portrait: Story = {
  args: { media: portraitImage },
  decorators: [
    (Story) => (
      <div className="max-w-sm">
        <Story />
      </div>
    ),
  ],
}

export const Breakout: Story = {
  args: { media: captioned, breakout: true },
}

export const Lightbox: Story = {
  args: { media: captioned },
  render: (args) => <LightboxMediaBlock {...args} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const trigger = canvas.getByRole("button")
    // Only the image opens the lightbox: the caption, and its links, sit outside the trigger.
    await expect(within(trigger).getByRole("img")).toHaveAttribute("alt", captioned.alt)
    await expect(within(trigger).queryByRole("link")).not.toBeInTheDocument()
    await expect(canvas.getByRole("link", { name: "County Archive" })).toBeInTheDocument()

    await userEvent.click(trigger)
    const dialog = await screen.findByRole("dialog")
    await expect(within(dialog).getByRole("img")).toHaveAttribute("alt", captioned.alt)
  },
}

/** The image in the feeds: a plain figure with an absolute URL and its caption. */
export const Feed: Story = {
  args: { media: captioned },
  render: ({ media }) => <FeedHTML html={mediaBlockToHTML({ media }, storyFeedContext())} />,
  play: async ({ canvasElement }) => {
    const figure = within(canvasElement).getByRole("figure")
    await expect(within(figure).getByRole("img")).toHaveAttribute(
      "src",
      `${window.location.origin}${captioned.url}`,
    )
    await expect(within(figure).getByRole("link", { name: "County Archive" })).toBeInTheDocument()
  },
}

export const LightboxWithoutCaption: Story = {
  render: (args) => <LightboxMediaBlock {...args} />,
  play: async ({ canvasElement }) => {
    const trigger = within(canvasElement).getByRole("button")
    await expect(within(trigger).getByRole("img")).toHaveAttribute("alt", landscapeImage.alt)
    // `picture` may only hold `<source>` and `<img>`, so the trigger needs a `figure` around it.
    await expect(trigger.closest("picture")).not.toBeInTheDocument()
    await expect(trigger.closest("figure")).toBeInTheDocument()

    await userEvent.click(trigger)
    const dialog = await screen.findByRole("dialog")
    await expect(within(dialog).getByRole("img")).toHaveAttribute("alt", landscapeImage.alt)
  },
}
