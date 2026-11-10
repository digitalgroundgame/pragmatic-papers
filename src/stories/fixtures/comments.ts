import type { CommentThread, CommentViewer, PublicComment } from "@/plugins/comments"

const hoursAgo = (hours: number) => new Date(Date.now() - hours * 3_600_000).toISOString()

const ada = { name: "Ada Reader", image: null, badge: null }
const grace = { name: "Grace Hopper", image: null, badge: "Editor" }

/** A short thread: a comment, a reply under it, a reply to a removed comment, and another. */
export const threadComments: PublicComment[] = [
  {
    id: 1,
    parentId: null,
    depth: 0,
    body: "The section on zoning reform is the clearest explanation I've read.",
    createdAt: hoursAgo(30),
    author: ada,
  },
  {
    id: 2,
    parentId: 1,
    depth: 1,
    body: "Thanks! The second chart's source is in the footnotes.",
    createdAt: hoursAgo(20),
    author: grace,
  },
  {
    id: 3,
    parentId: null,
    depth: 0,
    body: "",
    createdAt: hoursAgo(10),
    author: null,
    removed: true,
  },
  {
    id: 4,
    parentId: 3,
    depth: 1,
    body: "Whatever that said, I disagree with the conclusion here.\n\nHousing is regional.",
    createdAt: hoursAgo(2),
    author: ada,
  },
]

/** A credited writer of the article, joining in under it. */
export const writerComment: PublicComment = {
  id: 5,
  parentId: 1,
  depth: 1,
  body: "Glad it helped. The longer version is in the appendix.",
  createdAt: hoursAgo(1),
  author: { name: "Lin Writer", image: null, badge: "Staff writer", writer: true },
}

export const commentViewer: CommentViewer = { ...ada, locked: null, needsVerifiedEmail: false }

export const commentThread = (overrides: Partial<CommentThread> = {}): CommentThread => ({
  comments: threadComments,
  viewer: null,
  providers: [
    { id: "destiny", label: "Destiny.gg" },
    { id: "google", label: "Google" },
    { id: "discord", label: "Discord" },
  ],
  maxDepth: 5,
  maxLength: 2000,
  ...overrides,
})
