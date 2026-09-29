import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { expect, fn, userEvent, within } from "storybook/test"

import { PageProgress } from "./PageProgress"

const meta = {
  title: "Feed/PageProgress",
  component: PageProgress,
  globals: { theme: "dark" },
  args: { total: 5, activeIndex: 2, progress: 0.4, onJump: fn() },
  decorators: [
    (Story) => (
      <div className="w-[390px] bg-black p-3">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof PageProgress>

export default meta
type Story = StoryObj<typeof meta>

/** Pages before the active one are full, the active one fills as auto-play runs. */
export const Midway: Story = {
  play: async ({ canvasElement }) => {
    const tabs = within(canvasElement).getAllByRole("tab")
    await expect(tabs).toHaveLength(5)
    await expect(tabs[2]).toHaveAttribute("aria-selected", "true")
    const fills = within(canvasElement).getAllByTestId("page-progress-fill")
    await expect(fills[0]).toHaveAttribute("style", "transform: scaleX(1);")
    await expect(fills[2]).toHaveAttribute("style", "transform: scaleX(0.4);")
    await expect(fills[3]).toHaveAttribute("style", "transform: scaleX(0);")
  },
}

export const FirstPage: Story = {
  args: { activeIndex: 0, progress: 0 },
}

export const LastPageComplete: Story = {
  args: { activeIndex: 4, progress: 1 },
}

/** Tapping a segment jumps to that page, forwards or back. */
export const TapToJump: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole("tab", { name: "Go to page 5 of 5" }))
    await expect(args.onJump).toHaveBeenLastCalledWith(4)
    await userEvent.click(canvas.getByRole("tab", { name: "Go to page 1 of 5" }))
    await expect(args.onJump).toHaveBeenLastCalledWith(0)
  },
}

/** Arrow keys, Home and End move between pages from the focused segment. */
export const KeyboardJump: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    canvas.getByRole("tab", { selected: true }).focus()
    await userEvent.keyboard("{ArrowRight}")
    await expect(args.onJump).toHaveBeenLastCalledWith(3)
    await userEvent.keyboard("{Home}")
    await expect(args.onJump).toHaveBeenLastCalledWith(0)
  },
}

/** A one-page article has nothing to page through, so no bar at all. */
export const SinglePage: Story = {
  args: { total: 1, activeIndex: 0 },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).queryByRole("tablist")).not.toBeInTheDocument()
  },
}
