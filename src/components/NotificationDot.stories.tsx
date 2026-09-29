import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { Bell } from "lucide-react"
import { expect } from "storybook/test"

import { Button } from "@/components/ui/button"

import { NotificationDot } from "./NotificationDot"

const meta = {
  title: "Components/NotificationDot",
  component: NotificationDot,
  args: { visible: true },
  // The dot positions itself against the nearest `relative` ancestor, usually an icon button.
  render: (args) => (
    <Button variant="ghost" size="icon" className="relative">
      <Bell className="size-6" />
      <span className="sr-only">Notifications</span>
      <NotificationDot {...args} />
    </Button>
  ),
} satisfies Meta<typeof NotificationDot>

export default meta
type Story = StoryObj<typeof meta>

export const Visible: Story = {
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelector("[aria-hidden='true'].rounded-full")).toBeVisible()
  },
}

export const Hidden: Story = {
  args: { visible: false },
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelector(".rounded-full")).not.toBeInTheDocument()
  },
}
