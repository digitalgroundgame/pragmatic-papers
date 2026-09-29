import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { Bell } from "lucide-react"
import { expect } from "storybook/test"

import { Button } from "@/components/ui/button"
import { resetNotificationStore } from "@/providers/NotificationProvider"

import { NotificationDot } from "./NotificationDot"

const NAME = "storybook-demo"

/** Start each story as a reader who has (or hasn't) seen the notification. */
function seen(value: boolean): () => () => void {
  return () => {
    if (value) localStorage.setItem(`pp:seen:${NAME}`, "1")
    else localStorage.removeItem(`pp:seen:${NAME}`)
    resetNotificationStore()
    return () => {
      localStorage.removeItem(`pp:seen:${NAME}`)
      resetNotificationStore()
    }
  }
}

const meta = {
  title: "Components/NotificationDot",
  component: NotificationDot,
  args: { name: NAME },
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

/** A reader who hasn't seen the feature yet. */
export const Unseen: Story = {
  beforeEach: seen(false),
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelector("[data-slot='notification-dot']")).toBeVisible()
  },
}

/** A reader who has already seen it: no dot. */
export const Seen: Story = {
  beforeEach: seen(true),
  play: async ({ canvasElement }) => {
    await expect(
      canvasElement.querySelector("[data-slot='notification-dot']"),
    ).not.toBeInTheDocument()
  },
}
