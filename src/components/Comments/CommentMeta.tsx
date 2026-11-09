"use client"

import React from "react"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { formatFullTimestamp } from "@/heros/ArticleHero/dates"
import type { AuthorDisplay } from "@/plugins/comments"
import { formatTimeAgo } from "@/utilities/formatDate"
import { getInitials } from "@/utilities/getInitials"

export const AuthorAvatar: React.FC<{
  author: Pick<AuthorDisplay, "name" | "image">
  size?: "sm" | "md"
}> = ({ author, size = "md" }) => (
  <Avatar size={size} aria-hidden="true">
    {author.image ? <AvatarImage src={author.image} alt="" referrerPolicy="no-referrer" /> : null}
    <AvatarFallback>{getInitials(author.name)}</AvatarFallback>
  </Avatar>
)

/** "3 hours ago", with the full date and time on hover or focus. */
export const CommentTime: React.FC<{ createdAt: string }> = ({ createdAt }) => (
  <Tooltip>
    <TooltipTrigger
      render={<time dateTime={createdAt} />}
      tabIndex={0}
      className="text-muted-foreground cursor-default underline-offset-4 hover:underline hover:decoration-dotted"
    >
      {formatTimeAgo(createdAt)}
    </TooltipTrigger>
    <TooltipContent side="top" align="start">
      {formatFullTimestamp(createdAt)}
    </TooltipContent>
  </Tooltip>
)

const Dot: React.FC = () => (
  <span aria-hidden="true" className="text-muted-foreground">
    ·
  </span>
)

/** One line above a comment: who wrote it, their badge, and when. */
export const CommentMeta: React.FC<{
  author: AuthorDisplay
  createdAt: string
  children?: React.ReactNode
}> = ({ author, createdAt, children }) => (
  <p className="flex flex-wrap items-center gap-x-1.5 text-sm leading-6">
    <span className="font-semibold">{author.name}</span>
    {author.badge ? <Badge variant="secondary">{author.badge}</Badge> : null}
    <Dot />
    <CommentTime createdAt={createdAt} />
    {children ? (
      <>
        <Dot />
        {children}
      </>
    ) : null}
  </p>
)
