import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { Bell } from "lucide-react"
import { expect } from "storybook/test"

import { Button } from "@/components/ui/button"

import { DOTS, Dot } from "."
import { resetSeenStore, SEEN_KEY_PREFIX } from "./store"

const KEY = `${SEEN_KEY_PREFIX}${DOTS.modeToggle}`

/** Start each story as a reader who has (or hasn't) seen the dot. */
function seen(value: boolean): () => () => void {
  return () => {
    if (value) localStorage.setItem(KEY, "1")
    else localStorage.removeItem(KEY)
    resetSeenStore()
    return () => {
      localStorage.removeItem(KEY)
      resetSeenStore()
    }
  }
}

const meta = {
  title: "Components/Dot",
  component: Dot,
  args: { name: DOTS.modeToggle },
  // The dot positions itself against the nearest `relative` ancestor, usually an icon button.
  render: (args) => (
    <Button variant="ghost" size="icon" className="relative">
      <Bell className="size-6" />
      <span className="sr-only">Notifications</span>
      <Dot {...args} />
    </Button>
  ),
} satisfies Meta<typeof Dot>

export default meta
type Story = StoryObj<typeof meta>

/** A reader who hasn't seen the feature yet. */
export const Unseen: Story = {
  beforeEach: seen(false),
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelector("[data-slot='dot']")).toBeVisible()
  },
}

/** A reader who has already seen it: no dot. */
export const Seen: Story = {
  beforeEach: seen(true),
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelector("[data-slot='dot']")).not.toBeInTheDocument()
  },
}
