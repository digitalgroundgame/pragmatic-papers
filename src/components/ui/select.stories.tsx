import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { expect, fn, screen, userEvent, waitFor, within } from "storybook/test"

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "./select"

const items = [
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "popular", label: "Most read" },
]

const meta = {
  title: "UI/Select",
  component: Select,
  args: { items, defaultValue: "newest", onValueChange: fn() },
  render: (args) => (
    <Select {...args}>
      <SelectTrigger className="w-48" aria-label="Sort articles">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectLabel>Sort by</SelectLabel>
          {items.slice(0, 2).map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectGroup>
        <SelectSeparator />
        <SelectItem value={items[2]!.value}>{items[2]!.label}</SelectItem>
      </SelectContent>
    </Select>
  ),
} satisfies Meta<typeof Select>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ args, canvasElement }) => {
    const trigger = within(canvasElement).getByRole("combobox", { name: "Sort articles" })
    await expect(trigger).toHaveTextContent("Newest first")
    await userEvent.click(trigger)
    await userEvent.click(await screen.findByRole("option", { name: "Most read" }))
    await waitFor(() => expect(trigger).toHaveTextContent("Most read"))
    await expect(args.onValueChange).toHaveBeenCalledWith("popular", expect.anything())
    // The listbox stays mounted while it animates out; let it go before the axe check runs.
    await waitFor(() => expect(screen.queryByRole("listbox")).not.toBeInTheDocument())
  },
}

export const Disabled: Story = {
  args: { disabled: true },
}
