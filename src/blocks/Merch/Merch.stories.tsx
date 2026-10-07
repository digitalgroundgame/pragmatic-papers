import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { expect, mocked, within } from "storybook/test"

import type { Merch } from "@/payload-types"
import { knownContrastIssue } from "@/stories/a11y"
import { createFakePayload } from "@/stories/fixtures/payload"
import { getPayloadConfig } from "@/utilities/getPayloadConfig"

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
  parameters: { layout: "fullscreen", ...knownContrastIssue },
  args: { blockType: "merch", heading: "Support the Papers", layout: "fullWidth" },
  argTypes: {
    layout: { control: "inline-radio", options: ["fullWidth", "square"] },
  },
  beforeEach: () => {
    mocked(getPayloadConfig).mockResolvedValue(
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
