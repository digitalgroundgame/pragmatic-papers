import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { expect, within } from "storybook/test"

import { authors, userFixture } from "@/stories/fixtures/docs"
import { feedSummary, phoneFrame } from "@/stories/fixtures/feed"

import { FEED_TOP_INSET } from "./constants"
import { HeroPage } from "./HeroPage"

const meta = {
  title: "Feed/HeroPage",
  component: HeroPage,
  globals: { theme: "dark" },
  parameters: { layout: "centered" },
  decorators: [phoneFrame],
  args: { article: feedSummary(), topInset: FEED_TOP_INSET },
} satisfies Meta<typeof HeroPage>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole("heading", { level: 1 })).toHaveTextContent(args.article.title)
    await expect(canvas.getByText("The Local Issue")).toBeVisible()
    await expect(canvas.getByText("by Jordan Rivera")).toBeVisible()
    await expect(canvas.getByText("Elections, Housing")).toBeVisible()
    await expect(canvas.getByRole("link", { name: "Jordan Rivera" })).toHaveAttribute(
      "href",
      "/contributors/jordan-rivera",
    )
  },
}

/** No hero image: a brand gradient stands in behind the title card. */
export const WithoutImage: Story = {
  args: { article: feedSummary({ heroImage: null }) },
}

/** Past three authors, the avatar stack shows a count instead. */
export const ManyAuthors: Story = {
  args: {
    article: feedSummary({
      authors: [
        ...authors,
        userFixture({ id: 4, name: "Lee Park", slug: "lee-park", profileImage: null }),
        userFixture({ id: 5, name: "Ana Souza", slug: "ana-souza", profileImage: null }),
      ],
    }),
  },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByLabelText("2 more authors")).toHaveTextContent("+2")
  },
}

/** Only the title is required: no volume, excerpt, authors, date or topics. */
export const Minimal: Story = {
  args: {
    article: feedSummary({
      volume: null,
      meta: {},
      authors: [],
      topics: [],
      publishedAt: null,
    }),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.queryByText(/^by /)).not.toBeInTheDocument()
    await expect(canvas.queryByRole("time")).not.toBeInTheDocument()
  },
}
