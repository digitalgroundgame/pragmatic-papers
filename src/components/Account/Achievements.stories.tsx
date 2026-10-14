import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { expect, spyOn, within } from "storybook/test"

import type { HeldAchievement } from "@/plugins/achievements"

import { Achievements } from "./Achievements"

const earlyMember: HeldAchievement = {
  key: "early-member",
  label: "Early member",
  description: "One of the first readers to make an account.",
  badge: "Early member",
  earnedAt: "2026-10-18T12:00:00.000Z",
}
const verified: HeldAchievement = {
  key: "verified",
  label: "Verified",
  description: "Your sign-in provider verified your email address.",
  badge: "Verified",
  earnedAt: null,
}

/** Answers `/api/achievements/mine` with `held`, or 404 (switched off) when null. */
function serve(held: HeldAchievement[] | null) {
  return () => {
    const fetchSpy = spyOn(window, "fetch").mockImplementation(async () =>
      held ? Response.json({ achievements: held }) : Response.json({}, { status: 404 }),
    )
    return () => fetchSpy.mockRestore()
  }
}

const meta = {
  title: "Components/Account/Achievements",
  component: Achievements,
  decorators: [
    (Story) => (
      <div className="mx-auto max-w-xl p-4">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Achievements>

export default meta
type Story = StoryObj<typeof meta>

export const Several: Story = {
  beforeEach: serve([earlyMember, verified]),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByRole("heading", { name: "Achievements" })).toBeInTheDocument()
    const items = canvas.getAllByRole("listitem")
    await expect(items).toHaveLength(2)
    await expect(items[0]).toHaveTextContent("Early member")
    await expect(items[1]).toHaveTextContent("Verified")
  },
}

export const NoneYet: Story = {
  beforeEach: serve([]),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByText(/haven't earned any yet/)).toBeInTheDocument()
    await expect(canvas.queryByRole("list")).not.toBeInTheDocument()
  },
}

export const SwitchedOff: Story = {
  beforeEach: serve(null),
  play: async ({ canvasElement }) => {
    // Nothing to wait for: give the request a moment, then check nothing rendered.
    await new Promise((resolve) => setTimeout(resolve, 50))
    await expect(
      within(canvasElement).queryByRole("heading", { name: "Achievements" }),
    ).not.toBeInTheDocument()
  },
}
