"use client"

import { PlusIcon } from "lucide-react"
import React, { useEffect, useRef, useState } from "react"

import { Button } from "@/components/ui/button"

import { CommentActions } from "./CommentActions"
import { CommentForm, type Posted } from "./CommentForm"
import { AuthorAvatar, CommentMeta, CommentTime } from "./CommentMeta"
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
export const CommentItem: React.FC<{ node: CommentNode; reply: ReplyContext }> = ({
  node,
  reply,
}) => {
  const { comment, replies } = node
  const [replying, setReplying] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const [showAll, setShowAll] = useState(false)
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
  const toggle = (next: boolean) => {
    toggled.current = true
    setCollapsed(next)
  }

  const shown = showAll ? replies : replies.slice(0, REPLY_PREVIEW)
  const more = replies.slice(shown.length)
  const moreCount = more.reduce(
    (total, child) => total + (child.comment.removed ? 0 : 1) + replyCount(child),
    0,
  )

  return (
    <li id={`comment-${String(comment.id)}`} className="scroll-mt-24">
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
            <article className="space-y-1" aria-label={`Comment by ${comment.author!.name}`}>
              <CommentMeta author={comment.author!} createdAt={comment.createdAt} />
              <p className="text-base break-words whitespace-pre-line">{comment.body}</p>
              {comment.held ? (
                <p className="text-muted-foreground text-sm">
                  Only you can see this. It&apos;s waiting for a moderator.
                </p>
              ) : null}
              {comment.held ? null : (
                <CommentActions
                  id={comment.id}
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
                <CommentItem key={child.comment.id} node={child} reply={reply} />
              ))}
            </ol>
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
