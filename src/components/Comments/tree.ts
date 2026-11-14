import type { PublicComment } from "@/plugins/comments"

export interface CommentNode {
  comment: PublicComment
  replies: CommentNode[]
}

/** The orders a reader can put top-level comments in. Replies always read oldest first. */
export type CommentSort = "random" | "new" | "old"

export const COMMENT_SORTS: { value: CommentSort; label: string }[] = [
  { value: "random", label: "Random" },
  { value: "new", label: "New" },
  { value: "old", label: "Old" },
]

export const DEFAULT_SORT: CommentSort = "random"

export const isCommentSort = (value: unknown): value is CommentSort =>
  COMMENT_SORTS.some((sort) => sort.value === value)

/**
 * Nests a thread's comments under their parents, each level oldest first. A reply whose
 * parent isn't in the list (past the thread's limit) shows at the top level rather than not
 * at all.
 */
export function buildTree(comments: PublicComment[]): CommentNode[] {
  const nodes = new Map(comments.map((comment) => [String(comment.id), { comment, replies: [] }]))
  const roots: CommentNode[] = []
  for (const node of nodes.values()) {
    const parent =
      node.comment.parentId === null ? undefined : nodes.get(String(node.comment.parentId))
    ;(parent ? parent.replies : roots).push(node)
  }
  return roots
}

/** FNV-1a: a fast, well-spread 32-bit hash, so the same seed and id always land in one place. */
function hash(text: string): number {
  let value = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    value ^= text.charCodeAt(i)
    value = Math.imul(value, 0x01000193)
  }
  return value >>> 0
}

const time = (node: CommentNode) => new Date(node.comment.createdAt).getTime()

/**
 * Puts top-level comments in the reader's order and leaves replies as they are, so a
 * conversation under a comment still reads in order. `random` shuffles by `seed`, which a
 * reader keeps, so their order holds across reloads while each reader's differs. Comments in
 * `pinned` (the ones the reader just posted) go first, newest first, whatever the order.
 */
export function sortRoots(
  roots: CommentNode[],
  sort: CommentSort,
  seed: string,
  pinned: ReadonlySet<string> = new Set(),
): CommentNode[] {
  const compare: Record<CommentSort, (a: CommentNode, b: CommentNode) => number> = {
    old: (a, b) => time(a) - time(b),
    new: (a, b) => time(b) - time(a),
    random: (a, b) =>
      hash(`${seed}:${String(a.comment.id)}`) - hash(`${seed}:${String(b.comment.id)}`),
  }
  const isPinned = (node: CommentNode) => pinned.has(String(node.comment.id))
  return [...roots].sort((a, b) => {
    if (isPinned(a) !== isPinned(b)) return isPinned(a) ? -1 : 1
    return isPinned(a) ? time(b) - time(a) : compare[sort](a, b)
  })
}

/** How many comments sit under a node, at every depth. Placeholders don't count. */
export function replyCount(node: CommentNode): number {
  return node.replies.reduce(
    (total, child) => total + (child.comment.removed ? 0 : 1) + replyCount(child),
    0,
  )
}

/** How many comments a reader sees: placeholders for removed ones don't count. */
export function visibleCount(comments: PublicComment[]): number {
  return comments.filter((comment) => !comment.removed).length
}
