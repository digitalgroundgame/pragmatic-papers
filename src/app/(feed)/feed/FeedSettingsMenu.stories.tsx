import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { expect, screen, userEvent, within } from "storybook/test"

import { FeedSettingsMenu } from "./FeedSettingsMenu"

const meta = {
  title: "Feed/FeedSettingsMenu",
  component: FeedSettingsMenu,
  globals: { theme: "dark" },
  decorators: [
    (Story) => (
      <div className="flex w-[320px] justify-end bg-black p-3">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof FeedSettingsMenu>

export default meta
type Story = StoryObj<typeof meta>

export const Closed: Story = {}

/** The only way out of the feed's full-screen layout is this menu's Home link. */
export const Open: Story = {
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole("button", { name: "Open feed menu" }))
    await expect(await screen.findByRole("menuitem", { name: "Home" })).toHaveAttribute("href", "/")
  },
}
