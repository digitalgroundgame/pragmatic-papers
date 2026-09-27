import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { expect, screen, userEvent, waitFor, within } from "storybook/test"

import { Button } from "./button"
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "./sheet"

const meta = {
  title: "UI/Sheet",
  component: SheetContent,
  args: { side: "right" },
  argTypes: {
    side: { control: "inline-radio", options: ["top", "right", "bottom", "left"] },
  },
  render: (args) => (
    <Sheet>
      <SheetTrigger render={<Button variant="outline" />}>Open menu</SheetTrigger>
      <SheetContent {...args}>
        <SheetHeader>
          <SheetTitle>Menu</SheetTitle>
          <SheetDescription>Browse the site.</SheetDescription>
        </SheetHeader>
        <nav className="grid gap-2 px-4">
          <a href="/articles">Articles</a>
          <a href="/volumes">Volumes</a>
          <a href="/topics">Topics</a>
        </nav>
        <SheetFooter>
          <SheetClose render={<Button variant="outline" />}>Done</SheetClose>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  ),
} satisfies Meta<typeof SheetContent>

export default meta
type Story = StoryObj<typeof meta>

export const Right: Story = {
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole("button", { name: "Open menu" }))
    const sheet = await screen.findByRole("dialog", { name: "Menu" })
    await userEvent.click(within(sheet).getByRole("button", { name: "Close" }))
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
  },
}

export const Left: Story = {
  args: { side: "left" },
}

export const Bottom: Story = {
  args: { side: "bottom" },
}
