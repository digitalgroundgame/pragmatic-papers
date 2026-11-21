import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { expect, spyOn, within } from "storybook/test"

import { isolatedDocs } from "@/stories/isolatedDocs"

import type { MyReading } from "@/plugins/achievements"

import { ReadingStats } from "./ReadingStats"

/** Answers `/api/reading/mine` with `reading`, or 404 (achievements switched off) when null. */
function serve(reading: MyReading | null) {
  return () => {
    const fetchSpy = spyOn(window, "fetch").mockImplementation(async () =>
      reading ? Response.json(reading) : Response.json({}, { status: 404 }),
    )
    return () => fetchSpy.mockRestore()
  }
}

const meta = {
  title: "Components/Account/ReadingStats",
  component: ReadingStats,
  parameters: isolatedDocs("240px"),
  decorators: [
    (Story) => (
      <div className="mx-auto max-w-xl p-4">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ReadingStats>

export default meta
type Story = StoryObj<typeof meta>

export const Regular: Story = {
  beforeEach: serve({
    articlesRead: 1204,
    volumesRead: 31,
    daysVisited: 365,
    currentStreak: 12,
    longestStreak: 40,
  }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByRole("heading", { name: "Your reading" })).toBeInTheDocument()
    await expect(canvas.getByText("1,204 articles")).toBeInTheDocument()
    await expect(canvas.getByText("31 volumes")).toBeInTheDocument()
    await expect(canvas.getByText("12 days")).toBeInTheDocument()
  },
}

export const JustSignedUp: Story = {
  beforeEach: serve({
    articlesRead: 0,
    volumesRead: 0,
    daysVisited: 1,
    currentStreak: 1,
    longestStreak: 1,
  }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByText("0 articles")).toBeInTheDocument()
    await expect(canvas.getAllByText("1 day")).toHaveLength(3)
  },
}

export const SwitchedOff: Story = {
  beforeEach: serve(null),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await new Promise((resolve) => setTimeout(resolve, 50))
    await expect(canvas.queryByRole("heading", { name: "Your reading" })).not.toBeInTheDocument()
  },
}
