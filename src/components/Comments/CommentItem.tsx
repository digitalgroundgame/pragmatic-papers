"use client"

import React, { useState } from "react"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { AuthorDisplay } from "@/plugins/comments"
import { formatLongDate, formatTimeAgo } from "@/utilities/formatDate"
import { getInitials } from "@/utilities/getInitials"

import { CommentForm, type Posted } from "./CommentForm"
import type { CommentNode } from "./tree"

export const AuthorAvatar: React.FC<{ author: Pick<AuthorDisplay, "name" | "image"> }> = ({
  author,
}) => (
  <Avatar size="md" aria-hidden="true">
    {author.image ? <AvatarImage src={author.image} alt="" referrerPolicy="no-referrer" /> : null}
    <AvatarFallback>{getInitials(author.name)}</AvatarFallback>
  </Avatar>
)

/** What the thread lets the viewer do under each comment. */
export interface ReplyContext {
  /** Signed in and not locked. */
  canReply: boolean
  maxDepth: number
  maxLength: number
  threadURL: string
  onPosted: (posted: Posted) => void
}

const depthLimitMessage = (maxDepth: number) =>
  maxDepth === 0 ? "Replies are off here." : `Replies are limited to ${maxDepth} levels here.`

/** One comment, the way to reply to it, and its replies beneath it. */
export const CommentItem: React.FC<{ node: CommentNode; reply: ReplyContext }> = ({
  node,
  reply,
}) => {
  const { comment, replies } = node
  const [replying, setReplying] = useState(false)
  const atLimit = comment.depth >= reply.maxDepth
  const replyable = reply.canReply && !comment.removed && !comment.held

  return (
    <li className="space-y-3">
      {comment.removed ? (
        <p className="text-muted-foreground text-sm italic">This comment was removed.</p>
      ) : (
        <article className="flex gap-3" aria-label={`Comment by ${comment.author!.name}`}>
          <AuthorAvatar author={comment.author!} />
          <div className="min-w-0 flex-1 space-y-1">
            <p className="flex flex-wrap items-center gap-x-2 text-sm">
              <span className="font-semibold">{comment.author!.name}</span>
              {comment.author!.badge ? (
                <Badge variant="secondary">{comment.author!.badge}</Badge>
              ) : null}
              <time
                dateTime={comment.createdAt}
                title={formatLongDate(comment.createdAt)}
                className="text-muted-foreground"
              >
                {formatTimeAgo(comment.createdAt)}
              </time>
            </p>
            <p className="text-base break-words whitespace-pre-line">{comment.body}</p>
            {comment.held ? (
              <p className="text-muted-foreground text-sm">
                Only you can see this. It&apos;s waiting for a moderator.
              </p>
            ) : null}
            {replyable && !replying ? (
              atLimit ? (
                <p className="text-muted-foreground text-xs">{depthLimitMessage(reply.maxDepth)}</p>
              ) : (
                <Button
                  variant="link"
                  className="h-auto p-0 text-sm"
                  onClick={() => setReplying(true)}
                >
                  Reply
                </Button>
              )
            ) : null}
          </div>
        </article>
      )}
      {replying ? (
        <div className="pl-12">
          <CommentForm
            threadURL={reply.threadURL}
            maxLength={reply.maxLength}
            parentId={comment.id}
            label={`Reply to ${comment.author!.name}`}
            onCancel={() => setReplying(false)}
            onPosted={(posted) => {
              setReplying(false)
              reply.onPosted(posted)
            }}
          />
        </div>
      ) : null}
      {replies.length > 0 ? (
        <ol className="border-border space-y-4 border-l pl-3 sm:pl-5">
          {replies.map((child) => (
            <CommentItem key={child.comment.id} node={child} reply={reply} />
          ))}
        </ol>
      ) : null}
    </li>
  )
}
