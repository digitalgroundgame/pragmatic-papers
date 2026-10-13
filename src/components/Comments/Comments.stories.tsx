import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { expect, spyOn, userEvent, waitFor, within } from "storybook/test"

import type { CommentThread, PublicComment } from "@/plugins/comments"

import { Comments } from "."

const hoursAgo = (hours: number) => new Date(Date.now() - hours * 3_600_000).toISOString()

const comments: PublicComment[] = [
  {
    id: 1,
    body: "The section on zoning reform is the clearest explanation I've read.",
    createdAt: hoursAgo(30),
    author: { name: "Ada Reader", image: null },
  },
  {
    id: 2,
    body: "Agreed. Though the second chart could use a source.\n\nOtherwise great.",
    createdAt: hoursAgo(2),
    author: { name: "Grace Hopper", image: null },
  },
]

const thread = (overrides: Partial<CommentThread> = {}): CommentThread => ({
  comments,
  viewer: null,
  providers: ["google", "discord"],
  maxLength: 2000,
  ...overrides,
})

/** Answers the thread endpoint with `body`, and a post with the comment it was sent. */
function serve(body: CommentThread, status = 200) {
  return () => {
    const fetchSpy = spyOn(window, "fetch").mockImplementation(async (_input, init) => {
      if (init?.method === "POST") {
        const { body: text } = JSON.parse(String(init.body)) as { body: string }
        const comment: PublicComment = {
          id: 99,
          body: text,
          createdAt: new Date().toISOString(),
          author: { name: body.viewer?.name ?? "", image: null },
        }
        return Response.json({ comment }, { status: 201 })
      }
      return Response.json(body, { status })
    })
    return () => fetchSpy.mockRestore()
  }
}

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
  beforeEach: serve(thread()),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByText("Ada Reader")).toBeInTheDocument()
    await expect(canvas.getByRole("heading", { name: "Comments (2)" })).toBeInTheDocument()
    await expect(canvas.getByRole("button", { name: "Sign in with Google" })).toBeEnabled()
    await expect(canvas.getByRole("button", { name: "Sign in with Discord" })).toBeEnabled()
  },
}

export const SignedIn: Story = {
  beforeEach: serve(thread({ viewer: { name: "Ada Reader", image: null, banned: false } })),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const box = await canvas.findByRole("textbox", { name: /Commenting as Ada Reader/ })
    await userEvent.type(box, "Thanks for writing this.")
    await userEvent.click(canvas.getByRole("button", { name: "Post comment" }))
    await expect(await canvas.findByText("Thanks for writing this.")).toBeInTheDocument()
    await waitFor(() => expect(box).toHaveValue(""))
  },
}

export const Empty: Story = {
  beforeEach: serve(thread({ comments: [] })),
  play: async ({ canvasElement }) => {
    await expect(await within(canvasElement).findByText("No comments yet.")).toBeInTheDocument()
  },
}

export const Banned: Story = {
  beforeEach: serve(thread({ viewer: { name: "Spammer", image: null, banned: true } })),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(
      await canvas.findByText("A moderator has stopped this account from commenting."),
    ).toBeInTheDocument()
    await expect(canvas.queryByRole("textbox")).not.toBeInTheDocument()
  },
}

export const Unavailable: Story = {
  beforeEach: serve(thread(), 500),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByText(/Comments couldn.t load/)).toBeInTheDocument()
    await expect(canvas.getByRole("button", { name: "Try again" })).toBeInTheDocument()
  },
}
