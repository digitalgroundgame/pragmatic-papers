import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { expect, waitFor } from "storybook/test"

import { blockImages } from "."
import { BLOCK_ART } from "./art"

/** Every block's images as the admin's block drawer and editor menus load them, from `public/`. */
const BlockImageGallery = ({ slugs }: { slugs: string[] }) => (
  <ul className="grid list-none grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-4 p-4">
    {slugs.map((slug) => {
      const { icon, thumbnail } = blockImages(slug)
      return (
        <li key={slug} className="rounded-lg border p-2">
          {/* eslint-disable-next-line @next/next/no-img-element -- loads them as Payload's admin does */}
          <img
            src={thumbnail.url}
            alt={thumbnail.alt}
            width={240}
            height={160}
            className="w-full"
          />
          <span className="mt-2 flex items-center gap-2 text-sm">
            {/* eslint-disable-next-line @next/next/no-img-element -- loads them as Payload's admin does */}
            <img src={icon.url} alt={icon.alt} width={20} height={20} />
            {slug}
          </span>
        </li>
      )
    })}
  </ul>
)

const meta = {
  title: "Blocks/Picker images",
  component: BlockImageGallery,
  args: { slugs: Object.keys(BLOCK_ART) },
} satisfies Meta<typeof BlockImageGallery>

export default meta
type Story = StoryObj<typeof meta>

/** Each block's thumbnail (the page layout's block drawer) and icon (the editor's slash menu). */
export const AllBlocks: Story = {
  play: async ({ canvasElement, args }) => {
    const images = [...canvasElement.querySelectorAll("img")]
    await expect(images).toHaveLength(args.slugs.length * 2)
    // Every file exists and decodes: a missing or broken SVG loads with no width.
    await waitFor(() => {
      for (const image of images) expect(image.complete && image.naturalWidth > 0).toBe(true)
    })
  },
}
