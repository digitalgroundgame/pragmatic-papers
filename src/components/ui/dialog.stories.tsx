import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { expect, screen, userEvent, waitFor, within } from "storybook/test"

import { Button } from "./button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./dialog"

const meta = {
  title: "UI/Dialog",
  component: Dialog,
  render: (args) => (
    <Dialog {...args}>
      <DialogTrigger render={<Button variant="outline" />}>Unsubscribe</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Leave the newsletter?</DialogTitle>
          <DialogDescription>
            You will stop getting new volumes in your inbox. You can resubscribe any time.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>Keep me subscribed</DialogClose>
          <Button>Unsubscribe</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  ),
} satisfies Meta<typeof Dialog>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const trigger = within(canvasElement).getByRole("button", { name: "Unsubscribe" })
    await userEvent.click(trigger)
    const dialog = await screen.findByRole("dialog", { name: "Leave the newsletter?" })
    await expect(dialog).toHaveAccessibleDescription(/stop getting new volumes/)
    await userEvent.keyboard("{Escape}")
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
    await expect(trigger).toHaveFocus()
  },
}

export const Open: Story = {
  args: { defaultOpen: true },
}
