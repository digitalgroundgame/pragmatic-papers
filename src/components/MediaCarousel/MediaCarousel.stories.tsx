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

/**
 * Every slide's image fits inside the slide's 16:9 box, centred, whatever its
 * shape: nothing spills past the bottom, and a wide image isn't pinned to the top.
 */
async function expectImagesFitSlides(canvasElement: HTMLElement) {
  const slides = within(canvasElement).getAllByRole("group")
  for (const slide of slides) {
    const img = within(slide).getByRole("img") as HTMLImageElement
    const style = getComputedStyle(slide)
    const box = slide.getBoundingClientRect()
    const left = box.left + parseFloat(style.paddingLeft)
    const top = box.top + parseFloat(style.paddingTop)
    const right = box.right - parseFloat(style.paddingRight)
    const bottom = box.bottom - parseFloat(style.paddingBottom)
    const rect = img.getBoundingClientRect()
    const name = img.alt
    // Allow a pixel for sub-pixel rounding.
    await expect(rect.width, `${name} has a width`).toBeGreaterThan(0)
    await expect(rect.top, `${name} top`).toBeGreaterThanOrEqual(top - 1)
    await expect(rect.bottom, `${name} bottom`).toBeLessThanOrEqual(bottom + 1)
    await expect(rect.left, `${name} left`).toBeGreaterThanOrEqual(left - 1)
    await expect(rect.right, `${name} right`).toBeLessThanOrEqual(right + 1)
    await expect(Math.abs(rect.top + rect.bottom - top - bottom), `${name} centred`).toBeLessThan(2)
    await expect(Math.abs(rect.left + rect.right - left - right), `${name} centred`).toBeLessThan(2)
  }
}

export const Default: Story = {
  play: async ({ canvasElement }) => {
    await expectImagesFitSlides(canvasElement)
  },
}

export const StartsOnThird: Story = {
  args: { initialIndex: 2 },
  play: async ({ canvasElement }) => {
    await expectImagesFitSlides(canvasElement)
  },
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
    await expectImagesFitSlides(canvasElement)

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
