"use client"

import { CornerDownRightIcon, PlusIcon } from "lucide-react"
import React, { useEffect, useRef, useState } from "react"

import { Button, buttonVariants } from "@/components/ui/button"
import { cn } from "@/utilities/utils"

import { CommentActions } from "./CommentActions"
import { CommentForm, type Posted } from "./CommentForm"
import { AuthorAvatar, CommentMeta, CommentTime } from "./CommentMeta"
import { useThreadNav } from "./threadNav"
import { type CommentNode, replyCount } from "./tree"

export { AuthorAvatar } from "./CommentMeta"

/** What the thread lets the viewer do under each comment. */
export interface ReplyContext {
  /** Signed in and not locked. */
  canReply: boolean
  maxDepth: number
  maxLength: number
  threadURL: string
  onPosted: (posted: Posted) => void
  /** The article's slug, for analytics. */
  itemId?: string
}

/** How many replies each level shows before "N more replies". */
export const REPLY_PREVIEW = 3

const depthLimitMessage = (maxDepth: number) =>
  maxDepth === 0 ? "Replies are off here." : `Replies are limited to ${maxDepth} levels here.`

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`

/** The one row a collapsed comment shrinks to. */
const CollapsedRow: React.FC<{
  node: CommentNode
  who: string
  expandRef: React.Ref<HTMLButtonElement>
  onExpand: () => void
}> = ({ node, who, expandRef, onExpand }) => {
  const { comment } = node
  const hidden = replyCount(node)
  return (
    <div className="flex items-center gap-2 text-sm leading-6">
      <Button
        ref={expandRef}
        type="button"
        variant="ghost"
        size="icon-xs"
        aria-expanded={false}
        aria-label={`Expand ${who}`}
        onClick={onExpand}
      >
        <PlusIcon aria-hidden="true" />
      </Button>
      {comment.author ? (
        <>
          <AuthorAvatar author={comment.author} size="sm" />
          <span className="font-semibold">{comment.author.name}</span>
        </>
      ) : (
        <span className="text-muted-foreground italic">Removed comment</span>
      )}
      <span aria-hidden="true" className="text-muted-foreground">
        ·
      </span>
      <CommentTime createdAt={comment.createdAt} />
      {hidden > 0 ? (
        <span className="text-muted-foreground">({plural(hidden, "reply", "replies")})</span>
      ) : null}
    </div>
  )
}

/**
 * One comment, what a reader can do with it, and its replies beneath it. The line under the
 * avatar runs down beside the replies, so a reader can follow a branch by eye, and clicking it
 * folds the comment and everything under it into one row.
 */
export const CommentItem: React.FC<{
  node: CommentNode
  reply: ReplyContext
  /** How many levels below the top of the view this comment sits. */
  level?: number
}> = ({ node, reply, level = 0 }) => {
  const { comment, replies } = node
  const id = String(comment.id)
  const { continueDepth, path, highlighted } = useThreadNav()
  const [replying, setReplying] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  // A link to a reply past the first few opens them all, so it's there to scroll to.
  const linkedPastPreview = () =>
    replies.slice(REPLY_PREVIEW).some((child) => path.has(String(child.comment.id)))
  const [showAll, setShowAll] = useState(linkedPastPreview)
  const atLimit = comment.depth >= reply.maxDepth
  const replyable = reply.canReply && !comment.removed && !comment.held
  const who = comment.author ? `${comment.author.name}'s comment` : "removed comment"

  // Folding hides the button that was pressed, so focus moves to the one that undoes it.
  const collapseRef = useRef<HTMLButtonElement>(null)
  const expandRef = useRef<HTMLButtonElement>(null)
  const toggled = useRef(false)
  useEffect(() => {
    if (!toggled.current) return
    ;(collapsed ? expandRef : collapseRef).current?.focus()
  }, [collapsed])
  // Arriving on a link to this comment, or to one under it, opens what hides it.
  useEffect(() => {
    if (!path.has(id)) return
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the link arrives after mount
    setCollapsed(false)
    if (linkedPastPreview()) setShowAll(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only a new link should reopen
  }, [path])
  const toggle = (next: boolean) => {
    toggled.current = true
    setCollapsed(next)
  }

  // Deep enough, a branch continues on its own instead of indenting further.
  const continues = level >= continueDepth && replies.length > 0
  const shown = continues ? [] : showAll ? replies : replies.slice(0, REPLY_PREVIEW)
  const more = continues ? [] : replies.slice(shown.length)
  const moreCount = more.reduce(
    (total, child) => total + (child.comment.removed ? 0 : 1) + replyCount(child),
    0,
  )

  return (
    <li
      id={`comment-${id}`}
      data-highlighted={highlighted === id ? "" : undefined}
      className="scroll-mt-24"
    >
      {collapsed ? (
        <CollapsedRow node={node} who={who} expandRef={expandRef} onExpand={() => toggle(false)} />
      ) : null}
      {/* Hidden, not unmounted, while collapsed: a half-written reply keeps its text. */}
      <div className="flex gap-2" hidden={collapsed}>
        <div className="flex w-6 shrink-0 flex-col items-center">
          {comment.author && !comment.removed ? (
            <AuthorAvatar author={comment.author} size="sm" />
          ) : (
            <span aria-hidden="true" className="bg-muted size-6 shrink-0 rounded-full" />
          )}
          <Button
            ref={collapseRef}
            type="button"
            variant="ghost"
            aria-expanded
            aria-label={`Collapse ${who}`}
            onClick={() => toggle(true)}
            className="group/line mt-1 h-auto min-h-4 w-full flex-1 rounded-sm p-0 hover:bg-transparent aria-expanded:bg-transparent dark:hover:bg-transparent"
          >
            <span
              aria-hidden="true"
              className="bg-border group-hover/line:bg-foreground group-focus-visible/line:bg-foreground h-full w-px"
            />
          </Button>
        </div>

        <div className="min-w-0 flex-1 space-y-3 pb-1">
          {comment.removed ? (
            <p className="text-muted-foreground text-sm leading-6 italic">
              This comment was removed.
            </p>
          ) : (
            <article
              // Focusable, so arriving on its link puts a screen reader on it.
              tabIndex={-1}
              className={cn(
                "-mx-2 space-y-1 rounded-md px-2 transition-colors duration-700 outline-none",
                highlighted === id && "bg-muted",
              )}
              aria-label={`Comment by ${comment.author!.name}`}
            >
              <CommentMeta
                author={comment.author!}
                createdAt={comment.createdAt}
                firstComment={comment.firstComment}
              />
              <p className="text-base break-words whitespace-pre-line">{comment.body}</p>
              {comment.held ? (
                <p className="text-muted-foreground text-sm">
                  Only you can see this. It&apos;s waiting for a moderator.
                </p>
              ) : null}
              {comment.held ? null : (
                <CommentActions
                  id={comment.id}
                  itemId={reply.itemId}
                  replyLimit={replyable && atLimit ? depthLimitMessage(reply.maxDepth) : null}
                  onReply={replyable && !atLimit && !replying ? () => setReplying(true) : undefined}
                />
              )}
            </article>
          )}

          {replying ? (
            <CommentForm
              threadURL={reply.threadURL}
              maxLength={reply.maxLength}
              parentId={comment.id}
              itemId={reply.itemId}
              label={`Reply to ${comment.author!.name}`}
              onCancel={() => setReplying(false)}
              onPosted={(posted) => {
                setReplying(false)
                // The new reply goes last, so it mustn't land behind "more replies".
                setShowAll(true)
                reply.onPosted(posted)
              }}
            />
          ) : null}

          {shown.length > 0 ? (
            <ol className="space-y-3">
              {shown.map((child) => (
                <CommentItem key={child.comment.id} node={child} reply={reply} level={level + 1} />
              ))}
            </ol>
          ) : null}
          {continues ? (
            <a
              href={`#thread-${id}`}
              className={cn(buttonVariants({ variant: "link", size: "xs" }), "h-auto px-0")}
            >
              <CornerDownRightIcon aria-hidden="true" data-icon="inline-start" />
              Continue this thread ({plural(replyCount(node), "reply", "replies")})
            </a>
          ) : null}
          {more.length > 0 ? (
            <Button
              type="button"
              variant="link"
              size="xs"
              className="h-auto px-0"
              onClick={() => setShowAll(true)}
            >
              {plural(moreCount || more.length, "more reply", "more replies")}
            </Button>
          ) : null}
        </div>
      </div>
    </li>
  )
}
