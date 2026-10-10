import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { expect, spyOn, waitFor, within } from "storybook/test"

import { LazyAdminBar } from "./client.lazy"
import { ADMIN_BAR_ATTRIBUTE, ADMIN_BAR_HINT_KEY, ADMIN_BAR_HINT_SCRIPT } from "./hint"

const editor = { id: 1, email: "editor@example.com", collection: "users" }

/**
 * Payload answers `/api/users/me` with `user`, and the document lookup with nothing. With
 * `hinted`, the last page saw someone logged in, and the layout's script has run.
 */
function session(user: object | null, { hinted }: { hinted: boolean }) {
  return () => {
    localStorage.removeItem(ADMIN_BAR_HINT_KEY)
    document.documentElement.removeAttribute(ADMIN_BAR_ATTRIBUTE)
    if (hinted) localStorage.setItem(ADMIN_BAR_HINT_KEY, "1")
    new Function(ADMIN_BAR_HINT_SCRIPT)()
    const fetchSpy = spyOn(window, "fetch").mockImplementation(async (input) =>
      String(input).endsWith("/api/users/me")
        ? new Response(JSON.stringify({ user }))
        : new Response(JSON.stringify({ docs: [] })),
    )
    return () => {
      fetchSpy.mockRestore()
      localStorage.removeItem(ADMIN_BAR_HINT_KEY)
      document.documentElement.removeAttribute(ADMIN_BAR_ATTRIBUTE)
    }
  }
}

const slotHeight = (canvasElement: HTMLElement) =>
  (canvasElement.firstElementChild as HTMLElement).getBoundingClientRect().height

const meta = {
  title: "Components/AdminBar",
  component: LazyAdminBar,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof LazyAdminBar>

export default meta
type Story = StoryObj<typeof meta>

/** Back on the site: the slot holds the bar's height from the first paint, so nothing shifts. */
export const LoggedIn: Story = {
  beforeEach: session(editor, { hinted: true }),
  play: async ({ canvasElement }) => {
    await expect(slotHeight(canvasElement)).toBe(32)
    const canvas = within(canvasElement)
    await expect(await canvas.findByText("editor@example.com")).toBeInTheDocument()
    await expect(slotHeight(canvasElement)).toBe(32)
  },
}

/** A reader: no bar, no gap, and the bar's code is never fetched. */
export const Reader: Story = {
  beforeEach: session(null, { hinted: false }),
  play: async ({ canvasElement }) => {
    await waitFor(() => expect(window.fetch).toHaveBeenCalled())
    await expect(slotHeight(canvasElement)).toBe(0)
    await expect(within(canvasElement).queryByRole("link")).not.toBeInTheDocument()
  },
}

/** Logged in, with no hint yet (cleared storage): the bar still appears, and the hint is set. */
export const FirstVisit: Story = {
  beforeEach: session(editor, { hinted: false }),
  play: async ({ canvasElement }) => {
    await expect(await within(canvasElement).findByText("editor@example.com")).toBeInTheDocument()
    await expect(localStorage.getItem(ADMIN_BAR_HINT_KEY)).toBe("1")
    await expect(slotHeight(canvasElement)).toBe(32)
  },
}

/** The session expired since the last page: the slot collapses, and the hint is forgotten. */
export const SessionExpired: Story = {
  beforeEach: session(null, { hinted: true }),
  play: async ({ canvasElement }) => {
    await waitFor(() => expect(slotHeight(canvasElement)).toBe(0))
    await expect(localStorage.getItem(ADMIN_BAR_HINT_KEY)).toBeNull()
  },
}
