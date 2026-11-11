import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { expect, spyOn, waitFor } from "storybook/test"

import { isolatedDocs } from "@/stories/isolatedDocs"

import { ReadingBeacon } from "."

/**
 * Signs the browser in (the cookie sign-in sets for the page) when `signedIn`, and answers
 * `/api/reading` with 204. Returns the fetch spy for the story to check.
 */
function setUp(signedIn: boolean) {
  return () => {
    try {
      localStorage.removeItem("pp-visit-day")
    } catch {
      // Storage blocked: the beacon reports anyway.
    }
    document.cookie = signedIn ? "pp-signed-in=1; path=/" : "pp-signed-in=; path=/; max-age=0"
    const fetchSpy = spyOn(window, "fetch").mockImplementation(
      async () => new Response(null, { status: 204 }),
    )
    return () => {
      fetchSpy.mockRestore()
      document.cookie = "pp-signed-in=; path=/; max-age=0"
    }
  }
}

const reports = () =>
  (window.fetch as unknown as { mock: { calls: [string, RequestInit][] } }).mock.calls
    .filter(([url]) => url === "/api/reading")
    .map(([, init]) => JSON.parse(String(init.body)) as Record<string, unknown>)

const meta = {
  title: "Components/ReadingBeacon",
  component: ReadingBeacon,
  parameters: isolatedDocs("160px"),
  decorators: [
    (Story) => (
      <div className="relative mx-auto max-w-xl p-4">
        <p>The last paragraph of an article. The beacon sits just after it, out of the flow.</p>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ReadingBeacon>

export default meta
type Story = StoryObj<typeof meta>

/** On every page: a signed-in reader's visit, once a day. */
export const Visit: Story = {
  beforeEach: setUp(true),
  play: async () => {
    await waitFor(() => expect(reports()).toEqual([{ day: expect.any(String) }]))
  },
}

/** After an article: its end is on screen, so it counts as read. */
export const ArticleRead: Story = {
  args: { articleId: 10 },
  beforeEach: setUp(true),
  play: async () => {
    await waitFor(() => expect(reports()).toEqual([{ day: expect.any(String), article: 10 }]))
  },
}

/** Nobody signed in: nothing is sent. */
export const SignedOut: Story = {
  args: { articleId: 10 },
  beforeEach: setUp(false),
  play: async () => {
    await new Promise((resolve) => setTimeout(resolve, 100))
    await expect(reports()).toEqual([])
  },
}
