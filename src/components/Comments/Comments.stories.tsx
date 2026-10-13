import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { expect, spyOn, userEvent, waitFor, within } from "storybook/test"

import type { CommentThread, PublicComment } from "@/plugins/comments"
import { commentThread, commentViewer } from "@/stories/fixtures/comments"

import { Comments } from "."

/**
 * Answers the thread endpoint with `body`, and a post with the comment it was sent (held,
 * with `held` as the reason, when that's given).
 */
function serve(
  body: CommentThread,
  { status = 200, held }: { status?: number; held?: string } = {},
) {
  return () => {
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
    return () => fetchSpy.mockRestore()
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

export const Empty: Story = {
  beforeEach: serve(commentThread({ comments: [] })),
  play: async ({ canvasElement }) => {
    await expect(await within(canvasElement).findByText("No comments yet.")).toBeInTheDocument()
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
