import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { Bell } from "lucide-react"
import { expect } from "storybook/test"

import { Button } from "@/components/ui/button"

import { FRESH, Fresh } from "."
import { resetSeenStore, SEEN_KEY_PREFIX } from "./store"

const KEY = `${SEEN_KEY_PREFIX}${FRESH.modeToggle}`

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
  title: "Components/Fresh",
  component: Fresh,
  args: { name: FRESH.modeToggle },
  // The dot positions itself against the nearest `relative` ancestor, usually an icon button.
  render: (args) => (
    <Button variant="ghost" size="icon" className="relative">
      <Bell className="size-6" />
      <span className="sr-only">Notifications</span>
      <Fresh {...args} />
    </Button>
  ),
} satisfies Meta<typeof Fresh>

export default meta
type Story = StoryObj<typeof meta>

/** A reader who hasn't seen the feature yet. */
export const Unseen: Story = {
  beforeEach: seen(false),
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelector("[data-slot='fresh']")).toBeVisible()
  },
}

/** A reader who has already seen it: no dot. */
export const Seen: Story = {
  beforeEach: seen(true),
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelector("[data-slot='fresh']")).not.toBeInTheDocument()
  },
}
