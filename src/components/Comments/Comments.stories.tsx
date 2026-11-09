import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { expect, spyOn, userEvent, waitFor, within } from "storybook/test"

import type { CommentThread, PublicComment } from "@/plugins/comments"
import { commentThread, commentViewer } from "@/stories/fixtures/comments"

import { Comments } from "."
import { SEED_KEY, SORT_KEY } from "./useCommentOrder"

/**
 * Answers the thread endpoint with `body`, and a post with the comment it was sent (held,
 * with `held` as the reason, when that's given).
 */
function serve(
  body: CommentThread,
  { status = 200, held }: { status?: number; held?: string } = {},
) {
  return () => {
    // A fixed seed, so the random order is the same on every run.
    window.localStorage.setItem(SEED_KEY, "storybook")
    window.localStorage.removeItem(SORT_KEY)
    const fetchSpy = spyOn(window, "fetch").mockImplementation(async (_input, init) => {
      if (init?.method === "POST") {
        const { body: text, parentId } = JSON.parse(String(init.body)) as {
          body: string
          parentId?: number
        }
        const parent = body.comments.find((c) => c.id === parentId)
        const comment: PublicComment = {
          id: 99,
          parentId: parentId ?? null,
          depth: parent ? parent.depth + 1 : 0,
          body: text,
          createdAt: new Date().toISOString(),
          author: body.viewer,
          ...(held && { held: true as const }),
        }
        return Response.json({ comment, held }, { status: 201 })
      }
      return Response.json(body, { status })
    })
    return () => {
      fetchSpy.mockRestore()
      window.localStorage.removeItem(SEED_KEY)
      window.localStorage.removeItem(SORT_KEY)
    }
  }
}

const signedIn = (overrides: Partial<CommentThread> = {}) =>
  commentThread({ viewer: commentViewer, providers: [], ...overrides })

const meta = {
  title: "Components/Comments",
  component: Comments,
  args: { articleId: 1 },
  decorators: [
    (Story) => (
      <div className="mx-auto max-w-2xl p-4">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Comments>

export default meta
type Story = StoryObj<typeof meta>

export const SignedOut: Story = {
  beforeEach: serve(commentThread()),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByText(/zoning reform/)).toBeInTheDocument()
    await expect(canvas.getByRole("heading", { name: "Comments (3)" })).toBeInTheDocument()
    await expect(canvas.getByText("This comment was removed.")).toBeInTheDocument()
    await expect(canvas.getByRole("button", { name: "Sign in with Google" })).toBeEnabled()
    await expect(canvas.queryByRole("button", { name: "Reply" })).not.toBeInTheDocument()
  },
}

export const SignedIn: Story = {
  beforeEach: serve(signedIn()),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const box = await canvas.findByRole("textbox", { name: /Commenting as Ada Reader/ })
    await userEvent.type(box, "Thanks for writing this.")
    await userEvent.click(canvas.getByRole("button", { name: "Post comment" }))
    await expect(await canvas.findByText("Thanks for writing this.")).toBeInTheDocument()
    await waitFor(() => expect(box).toHaveValue(""))
    await expect(canvas.getByRole("link", { name: "Your account" })).toHaveAttribute(
      "href",
      "/account",
    )
  },
}

export const Replying: Story = {
  beforeEach: serve(signedIn()),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const [first] = await canvas.findAllByRole("button", { name: "Reply" })
    await userEvent.click(first!)
    const box = canvas.getByRole("textbox", { name: "Reply to Ada Reader" })
    await userEvent.type(box, "Which footnote?")
    await userEvent.click(canvas.getByRole("button", { name: "Post reply" }))
    await waitFor(() => expect(box).not.toBeInTheDocument())
    await expect(canvas.getByText("Which footnote?")).toBeInTheDocument()
  },
}

export const DepthLimit: Story = {
  beforeEach: serve(signedIn({ maxDepth: 1 })),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findAllByText("Replies are limited to 1 levels here.")).toHaveLength(
      2,
    )
  },
}

export const Held: Story = {
  beforeEach: serve(signedIn(), { held: "More than 2 links" }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const box = await canvas.findByRole("textbox", { name: /Commenting as/ })
    await userEvent.type(box, "Links: a.test b.test c.test")
    await userEvent.click(canvas.getByRole("button", { name: "Post comment" }))
    await expect(await canvas.findByText(/waiting for a moderator \(more than/)).toBeInTheDocument()
    await expect(canvas.getByText(/Only you can see this/)).toBeInTheDocument()
  },
}

export const Locked: Story = {
  beforeEach: serve(
    signedIn({ viewer: { ...commentViewer, locked: { until: "2026-11-01T00:00:00.000Z" } } }),
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByText(/can't comment until/)).toBeInTheDocument()
    await expect(canvas.queryByRole("textbox")).not.toBeInTheDocument()
  },
}

export const Blocked: Story = {
  beforeEach: serve(signedIn({ viewer: { ...commentViewer, locked: { until: null } } })),
  play: async ({ canvasElement }) => {
    await expect(
      await within(canvasElement).findByText(
        "A moderator has stopped this account from commenting.",
      ),
    ).toBeInTheDocument()
  },
}

export const NeedsVerifiedEmail: Story = {
  beforeEach: serve(signedIn({ viewer: { ...commentViewer, needsVerifiedEmail: true } })),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByText(/needs a verified email address/)).toBeInTheDocument()
    await expect(canvas.queryByRole("textbox")).not.toBeInTheDocument()
    await expect(canvas.queryByRole("button", { name: "Reply" })).not.toBeInTheDocument()
  },
}

export const Empty: Story = {
  beforeEach: serve(commentThread({ comments: [] })),
  play: async ({ canvasElement }) => {
    await expect(await within(canvasElement).findByText("No comments yet.")).toBeInTheDocument()
  },
}

/** A thread past the most comments one loads shows its newest, and says so. */
export const Truncated: Story = {
  beforeEach: serve(commentThread({ truncated: true })),
  play: async ({ canvasElement }) => {
    await expect(
      await within(canvasElement).findByText(/Showing the newest comments/),
    ).toBeInTheDocument()
  },
}

export const Unavailable: Story = {
  beforeEach: serve(commentThread(), { status: 500 }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByText(/Comments couldn.t load/)).toBeInTheDocument()
    await expect(canvas.getByRole("button", { name: "Try again" })).toBeInTheDocument()
  },
}

/** The reader picks an order; replies stay under their comment, oldest first. */
export const Sorted: Story = {
  beforeEach: serve(commentThread()),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const page = within(canvasElement.ownerDocument.body)
    const topLevel = () => [...canvasElement.querySelectorAll("section > ol > li")]
    await userEvent.click(await canvas.findByRole("combobox", { name: "Sort comments" }))
    await userEvent.click(await page.findByRole("option", { name: "Old" }))
    await waitFor(() => expect(topLevel()[0]).toHaveTextContent(/zoning reform/))
    await userEvent.click(canvas.getByRole("combobox", { name: "Sort comments" }))
    await userEvent.click(await page.findByRole("option", { name: "New" }))
    await waitFor(() => expect(topLevel()[0]).toHaveTextContent("This comment was removed."))
    await expect(window.localStorage.getItem(SORT_KEY)).toBe("new")
  },
}

/** The line beside a comment's replies folds it, and them, into one row. */
export const Collapsed: Story = {
  beforeEach: serve(commentThread()),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await canvas.findByText(/zoning reform/)
    const comment = within(canvasElement.querySelector<HTMLElement>("#comment-1")!)
    const [line] = comment.getAllByRole("button", { name: "Collapse Ada Reader's comment" })
    await userEvent.click(line!)
    const expand = comment.getByRole("button", { name: "Expand Ada Reader's comment" })
    await expect(expand).toHaveAttribute("aria-expanded", "false")
    await expect(expand).toHaveFocus()
    await expect(canvas.getByText("(1 reply)")).toBeVisible()
    await expect(canvas.getByText(/second chart's source/)).not.toBeVisible()
  },
}

const [first, reply] = commentThread().comments
const longBranch = [
  first!,
  ...Array.from({ length: 6 }, (_, i) => ({
    ...reply!,
    id: 20 + i,
    createdAt: new Date(Date.parse(reply!.createdAt) + i * 60_000).toISOString(),
    body: `Reply number ${i + 1}.`,
  })),
]

/** A branch shows its first replies, and the rest on request. */
export const LongBranch: Story = {
  beforeEach: serve(commentThread({ comments: longBranch })),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByText("Reply number 3.")).toBeInTheDocument()
    await expect(canvas.queryByText("Reply number 4.")).not.toBeInTheDocument()
    await userEvent.click(canvas.getByRole("button", { name: "3 more replies" }))
    await expect(canvas.getByText("Reply number 6.")).toBeInTheDocument()
  },
}

/** Share copies the comment's link. */
export const Share: Story = {
  beforeEach: serve(commentThread()),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const writeText = spyOn(navigator.clipboard, "writeText").mockResolvedValue()
    const [share] = await canvas.findAllByRole("button", { name: "Share" })
    await userEvent.click(share!)
    await expect(await canvas.findByRole("status")).toHaveTextContent("Link copied")
    await expect(writeText).toHaveBeenCalledWith(expect.stringMatching(/#comment-\d+$/))
    writeText.mockRestore()
  },
}

/** Near the most a comment can hold, the box counts down what's left. */
export const NearLimit: Story = {
  beforeEach: serve(signedIn({ maxLength: 40 })),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const box = await canvas.findByRole("textbox", { name: /Commenting as/ })
    await userEvent.type(box, "This is getting very close to the end")
    await expect(canvas.getByText("3 characters left")).toBeInTheDocument()
  },
}
