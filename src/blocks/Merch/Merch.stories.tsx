import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { expect, mocked, waitFor, within } from "storybook/test"

import type { Merch } from "@/payload-types"
import { createFakePayload } from "@/stories/fixtures/payload"
import { getPayloadClient } from "@/data/payload"

import { MerchBlock } from "./Component"

// Set for every story in .storybook/main.ts.
const STORE = process.env.MERCH_SITE_URL

const products: Merch[] = [
  ["Pragmatic Papers Tee", "28.00", true, null],
  ["Volume XII Tote", "22.00", true, "New"],
  ["Ballot Box Mug", "16.00", false, null],
  ["Local Issue Poster", "12.00", true, null],
  ["Squiggle Sticker Pack", "6.00", true, null],
].map(([title, price, availableForSale, badgeOverride], i) => ({
  id: i + 1,
  title: title as string,
  externalId: `gid://shopify/Product/${i + 1}`,
  handle: (title as string).toLowerCase().replaceAll(" ", "-"),
  price: price as string,
  currencyCode: "USD",
  availableForSale: availableForSale as boolean,
  badgeOverride: badgeOverride as string | null,
  imageUrl: "/storybook-assets/square.svg",
  imageWidth: 800,
  imageHeight: 800,
  imageAlt: title as string,
  createdAt: "2026-01-15T12:00:00.000Z",
  updatedAt: "2026-01-15T12:00:00.000Z",
}))

const meta = {
  title: "Blocks/Merch",
  component: MerchBlock,
  parameters: { layout: "fullscreen" },
  args: { blockType: "merch", heading: "Support the Papers", layout: "fullWidth" },
  argTypes: {
    layout: { control: "inline-radio", options: ["fullWidth", "square"] },
  },
  beforeEach: () => {
    mocked(getPayloadClient).mockResolvedValue(
      createFakePayload({ collections: { merch: products } }),
    )
  },
} satisfies Meta<typeof MerchBlock>

export default meta
type Story = StoryObj<typeof meta>

export const FullWidth: Story = {
  play: async ({ canvasElement }) => {
    const section = await within(canvasElement).findByRole("region", {
      name: "Support the Papers",
    })
    // The carousel loads lazily, so its slides arrive a moment after the section.
    const tee = await within(section).findByRole("link", { name: /Pragmatic Papers Tee/ })
    await expect(tee).toHaveAttribute(
      "href",
      expect.stringContaining(`${STORE}/pragmatic-papers-tee`),
    )
    await expect(within(section).getByText("Sold Out")).toBeInTheDocument()
  },
}

export const Square: Story = {
  args: { layout: "square" },
  decorators: [
    (Story) => (
      <div className="max-w-sm p-4">
        <Story />
      </div>
    ),
  ],
}

export const NoHeading: Story = {
  args: { heading: null },
}

/**
 * Records the layout shifts inside `root` from now on, as Core Web Vitals'
 * CLS counts them (not within half a second of input).
 */
function watchLayoutShifts(root: Element): { shifts: string[]; stop: () => void } {
  const shifts: string[] = []
  const observer = new PerformanceObserver((list) => {
    for (const entry of list.getEntries() as unknown as LayoutShiftLike[]) {
      if (entry.hadRecentInput) continue
      for (const source of entry.sources) {
        if (source.node && root.contains(source.node)) {
          const { x, width } = source.previousRect
          const now = source.currentRect
          shifts.push(`${source.node.nodeName} x=${x} w=${width} -> x=${now.x} w=${now.width}`)
        }
      }
    }
  })
  observer.observe({ type: "layout-shift" })
  return { shifts, stop: () => observer.disconnect() }
}

/** `LayoutShift` isn't in TypeScript's DOM types yet. */
interface LayoutShiftLike {
  hadRecentInput: boolean
  sources: { node: Node | null; previousRect: DOMRectReadOnly; currentRect: DOMRectReadOnly }[]
}

let layoutShifts: ReturnType<typeof watchLayoutShifts> | undefined

/**
 * The arrows are in the first paint, so nothing in the header moves when the
 * carousel measures itself and finds there's something to page to. They used
 * to arrive only then, pushing "Shop all" aside on every page with the block.
 */
export const ArrowsDontShiftTheHeader: Story = {
  beforeEach: ({ canvasElement }) => {
    layoutShifts = watchLayoutShifts(canvasElement)
    return () => layoutShifts?.stop()
  },
  play: async ({ canvasElement }) => {
    const section = await within(canvasElement).findByRole("region", {
      name: "Support the Papers",
    })
    const next = await within(section).findByRole("button", { name: "Next slide" })
    // Enabled once embla has measured and found more products than fit.
    await waitFor(() => expect(next).toBeEnabled())
    // Layout-shift entries are delivered after the frame that caused them.
    await new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve, 100)))
    await expect(layoutShifts?.shifts).toEqual([])
  },
}
