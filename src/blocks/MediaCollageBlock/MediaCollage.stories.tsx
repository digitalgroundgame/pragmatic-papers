import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { expect, userEvent, waitFor, within } from "storybook/test"

import { landscapeImage, portraitImage, squareImage, wideImage } from "@/stories/fixtures/media"

import { MediaCollageBlock } from "./component"

const images = [landscapeImage, squareImage, portraitImage, wideImage].map((media, i) => ({
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

export const Grid: Story = {}

export const OddCount: Story = {
  args: { images: images.slice(0, 3) },
}

export const Carousel: Story = {
  args: { layout: "carousel" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const second = canvas.getByRole("button", { name: "Go to slide 2" })
    await userEvent.click(canvas.getByRole("button", { name: "Next slide" }))
    await waitFor(() => expect(second).toHaveClass("bg-primary"))
  },
}
