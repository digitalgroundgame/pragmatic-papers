import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { expect, screen, userEvent, waitFor, within } from "storybook/test"

import type { Media } from "@/payload-types"
import { FeedHTML } from "@/stories/FeedHTML"
import { captionedImage } from "@/stories/fixtures/blocks"
import { storyFeedContext } from "@/stories/fixtures/feedContext"
import { landscapeImage, mediaFixture, portraitImage, squareImage } from "@/stories/fixtures/media"
import { createParagraph, richText, SENTENCES } from "@/stories/fixtures/richText"

import { MediaBlock } from "./Component"
import { mediaBlockToHTML } from "./converters"
import { LightboxMediaBlock } from "./LightboxMediaBlock"

const captioned = captionedImage

/**
 * An upload far narrower than the viewport. A data URL skips next/image's srcset, which would
 * otherwise scale the file to the viewport's width.
 */
const smallImageUrl = `data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="480" height="270" viewBox="0 0 16 9"><rect width="16" height="9" fill="#2a9d8f"/></svg>',
)}`
const smallImage = mediaFixture({
  url: smallImageUrl,
  width: 480,
  height: 270,
  sizes: { xlarge: { url: smallImageUrl, width: 480, height: 270, mimeType: "image/svg+xml" } },
})

const longCaption = mediaFixture({
  caption: richText(createParagraph(SENTENCES.join(" "))) as Media["caption"],
})

/** Opens the lightbox and checks its close button sits inside the image's top-right corner. */
async function openLightbox(canvasElement: HTMLElement): Promise<HTMLElement> {
  await userEvent.click(within(canvasElement).getByRole("button"))
  const dialog = await screen.findByRole("dialog")
  const img = within(dialog).getByRole<HTMLImageElement>("img")
  await waitFor(() => expect(img.complete && img.naturalWidth > 0).toBe(true))
  const close = within(dialog).getByRole("button", { name: "Close" })
  await waitFor(() => {
    const image = img.getBoundingClientRect()
    const button = close.getBoundingClientRect()
    expect(button.right).toBeLessThanOrEqual(image.right)
    expect(button.right).toBeGreaterThan(image.right - 16)
    expect(button.top).toBeGreaterThanOrEqual(image.top)
    expect(button.top).toBeLessThan(image.top + 16)
  })
  return dialog
}

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

    const dialog = await openLightbox(canvasElement)
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

    const dialog = await openLightbox(canvasElement)
    await expect(within(dialog).getByRole("img")).toHaveAttribute("alt", landscapeImage.alt)
  },
}

export const LightboxSquare: Story = {
  args: { media: squareImage },
  render: (args) => <LightboxMediaBlock {...args} />,
  play: async ({ canvasElement }) => {
    await openLightbox(canvasElement)
  },
}

export const LightboxPortrait: Story = {
  args: { media: portraitImage },
  render: (args) => <LightboxMediaBlock {...args} />,
  play: async ({ canvasElement }) => {
    await openLightbox(canvasElement)
  },
}

/** An image narrower than the viewport keeps its size, with the close button on it. */
export const LightboxSmallImage: Story = {
  args: { media: smallImage },
  render: (args) => <LightboxMediaBlock {...args} />,
  play: async ({ canvasElement }) => {
    await openLightbox(canvasElement)
  },
}

/** A long caption wraps at the image's width instead of widening the lightbox. */
export const LightboxLongCaption: Story = {
  args: { media: longCaption },
  render: (args) => <LightboxMediaBlock {...args} />,
  play: async ({ canvasElement }) => {
    const dialog = await openLightbox(canvasElement)
    const image = within(dialog).getByRole("img").getBoundingClientRect()
    const caption = dialog.querySelector("figcaption")!.getBoundingClientRect()
    await expect(caption.width).toBeLessThanOrEqual(image.width + 1)
  },
}
