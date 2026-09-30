import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { expect, screen, userEvent, waitFor, within } from "storybook/test"

import { Button } from "./button"
import { Popover, PopoverContent, PopoverTrigger } from "./popover"

const meta = {
  title: "UI/Popover",
  component: Popover,
  render: (args) => (
    <Popover {...args}>
      <PopoverTrigger render={<Button variant="outline" />}>About this map</PopoverTrigger>
      <PopoverContent aria-label="About this map">
        <p className="text-sm">
          Margins are two-party vote share. Hover a county to see its totals.
        </p>
      </PopoverContent>
    </Popover>
  ),
} satisfies Meta<typeof Popover>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const trigger = within(canvasElement).getByRole("button", { name: "About this map" })
    await userEvent.click(trigger)
    await expect(trigger).toHaveAttribute("aria-expanded", "true")
    const body = await screen.findByText(/two-party vote share/)
    await waitFor(() => expect(body).toBeVisible())
    await userEvent.keyboard("{Escape}")
    await waitFor(() => expect(trigger).toHaveAttribute("aria-expanded", "false"))
    // The popup stays mounted while it animates out; let it go before the axe check runs.
    await waitFor(() => expect(body).not.toBeInTheDocument())
  },
}

export const Open: Story = {
  args: { defaultOpen: true },
}
