import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { Bell, User } from "lucide-react"
import { expect, userEvent, waitFor } from "storybook/test"

import { Button } from "@/components/ui/button"

import { FRESH, Fresh, useFresh } from "."
import { resetSeenStore, SEEN_KEY_PREFIX } from "./store"

const KEY = `${SEEN_KEY_PREFIX}${FRESH.modeToggle}`

// Every story on the docs page shares this browser's localStorage and the one
// in-memory store, and opening a mode toggle anywhere in Storybook marks the dot
// seen. So each story starts unseen, and "seen" is something you do in the demo.
function showAgain(): void {
  localStorage.removeItem(KEY)
  resetSeenStore()
}

function Demo(): React.ReactNode {
  const { freshDot, markSeen } = useFresh(FRESH.modeToggle)
  return (
    <div className="flex items-center gap-4">
      <Button variant="ghost" size="icon" className="relative" onClick={markSeen}>
        <Bell className="size-6" />
        <span className="sr-only">Try the feature</span>
        {freshDot}
      </Button>
      {/* Somewhere else pointing at the same feature, like the header's account button. */}
      <Button variant="ghost" size="icon" className="relative">
        <User className="size-6" />
        <span className="sr-only">Account</span>
        <Fresh name={FRESH.modeToggle} />
      </Button>
      <Button variant="outline" size="sm" onClick={showAgain}>
        Show it again
      </Button>
    </div>
  )
}

const meta = {
  title: "Components/Fresh",
  component: Fresh,
  args: { name: FRESH.modeToggle },
  beforeEach: () => {
    showAgain()
    return showAgain
  },
} satisfies Meta<typeof Fresh>

export default meta
type Story = StoryObj<typeof meta>

/**
 * A dot on whatever introduces the feature, and on anything else that points at
 * it. Click the bell (the feature) and both clear; "Show it again" forgets that
 * you've seen it.
 */
export const Default: Story = {
  render: () => <Demo />,
  play: async ({ canvas, canvasElement }) => {
    const dots = (): NodeListOf<Element> => canvasElement.querySelectorAll("[data-slot='fresh']")
    await expect(dots()).toHaveLength(2)

    await userEvent.click(canvas.getByRole("button", { name: "Try the feature" }))
    await waitFor(() => expect(dots()).toHaveLength(0))
    await expect(localStorage.getItem(KEY)).toBe("1")

    await userEvent.click(canvas.getByRole("button", { name: "Show it again" }))
    await waitFor(() => expect(dots()).toHaveLength(2))
  },
}

/** The dot alone, in the top-right corner of the nearest `relative` element. */
export const OnAnIcon: Story = {
  render: (args) => (
    <Button variant="ghost" size="icon" className="relative">
      <Bell className="size-6" />
      <span className="sr-only">Notifications</span>
      <Fresh {...args} />
    </Button>
  ),
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelector("[data-slot='fresh']")).toBeVisible()
  },
}
