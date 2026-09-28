import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { expect, screen, userEvent, within } from "storybook/test"

import { landscapeImage, mediaFixture, portraitImage } from "@/stories/fixtures/media"
import {
  createLinkNode,
  createParagraph,
  createTextNode,
  richText,
} from "@/stories/fixtures/richText"

import { MediaBlock } from "./Component"
import { LightboxMediaBlock } from "./LightboxMediaBlock"

const captioned = mediaFixture({
  caption: richText(
    createParagraph([
      createTextNode("The ridge above town at dusk. Photo: "),
      createLinkNode("County Archive", "https://example.com/archive"),
    ]),
  ),
})

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
