import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { expect, screen, userEvent, waitFor, within } from "storybook/test"

import { NarrationPlayer } from "@/components/NarrationPlayer"
import type { Media as MediaDoc } from "@/payload-types"
import { authors } from "@/stories/fixtures/docs"
import { landscapeImage, narrationAudio, portraitImage } from "@/stories/fixtures/media"

import { Media } from "."

// `Media` takes a union of per-type props, which Storybook's arg types would
// intersect into something no doc satisfies.
const meta = {
  title: "Components/Media",
  component: Media,
  args: { media: landscapeImage },
  render: ({ media }) => <Media media={media} />,
  decorators: [
    (Story) => (
      <div className="max-w-2xl">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<{ media: MediaDoc }>

export default meta
type Story = StoryObj<typeof meta>

export const Image: Story = {
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole("img")).toHaveAttribute("alt", landscapeImage.alt)
  },
}

export const ImageWithFocalPoint: Story = {
  args: { media: { ...portraitImage, focalX: 50, focalY: 20 } },
  render: (args) => (
    <div className="aspect-video overflow-hidden rounded-sm border">
      <Media media={args.media} className="h-full w-full object-cover" />
    </div>
  ),
}

export const Audio: Story = {
  args: { media: narrationAudio },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByRole("slider", { name: "Seek" })).toBeInTheDocument()
    await userEvent.click(canvas.getByRole("button", { name: "Play" }))
    await waitFor(() => expect(canvas.getByRole("button", { name: "Pause" })).toBeInTheDocument())
    await userEvent.click(canvas.getByRole("button", { name: "Pause" }))
  },
}

export const AudioSettings: Story = {
  args: { media: narrationAudio },
  play: async ({ canvasElement }) => {
    await userEvent.click(
      await within(canvasElement).findByRole("button", { name: "Player settings" }),
    )
    await userEvent.click(await screen.findByRole("menuitemradio", { name: /1\.5/ }))
    await waitFor(() =>
      expect(canvasElement.querySelector("audio")).toHaveProperty("playbackRate", 1.5),
    )
  },
}

export const Narration: Story = {
  render: () => <NarrationPlayer narration={{ ...narrationAudio, narrator: authors[0] }} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const controls = canvasElement.querySelector("[data-slot=audio-controls]")
    await expect(controls).toHaveAttribute("inert")
    await userEvent.click(canvas.getByRole("button", { name: "Play" }))
    await waitFor(() => expect(controls).not.toHaveAttribute("inert"))
    await userEvent.click(canvas.getByRole("button", { name: "Player settings" }))
    await expect(await screen.findByRole("menuitem", { name: "Jordan Rivera" })).toHaveAttribute(
      "href",
      "/authors/jordan-rivera",
    )
  },
}
