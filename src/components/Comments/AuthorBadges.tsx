"use client"

import {
  AwardIcon,
  BadgeCheckIcon,
  CakeIcon,
  CrownIcon,
  FeatherIcon,
  type LucideIcon,
  MailCheckIcon,
  MedalIcon,
  MicIcon,
  PartyPopperIcon,
  PenLineIcon,
  ShieldCheckIcon,
  SparklesIcon,
  SproutIcon,
  SquarePenIcon,
} from "lucide-react"
import React from "react"

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import type { AuthorDisplay, BadgeInfo } from "@/plugins/comments"
import { cn } from "@/utilities/utils"

interface BadgeLook {
  /** What the badge is called: its accessible name, and the tooltip's first words. */
  name: string
  icon: LucideIcon
  className: string
  /** Said in the tooltip, after the badge's name. */
  description?: string
}

// The markers the site works out for each comment, in the order they show.
const WRITER: BadgeLook = {
  name: "Writer",
  icon: FeatherIcon,
  className: "text-blue-600 dark:text-blue-400",
  description: "Wrote this article",
}
const CAKE_DAY: BadgeLook = {
  name: "Cake day",
  icon: CakeIcon,
  className: "text-pink-600 dark:text-pink-400",
  description: "Joined on this day",
}
const FIRST_COMMENT: BadgeLook = {
  name: "First comment",
  icon: PartyPopperIcon,
  className: "text-sky-600 dark:text-sky-400",
  description: "Their first comment on the site",
}
const NEW_COMMENTER: BadgeLook = {
  name: "New commenter",
  icon: SparklesIcon,
  className: "text-amber-500 dark:text-amber-400",
  description: "Started commenting in the last week",
}
const NEW_MEMBER: BadgeLook = {
  name: "New member",
  icon: SproutIcon,
  className: "text-lime-600 dark:text-lime-400",
  description: "Joined in the last month",
}

/**
 * The looks of the badges a commenter can carry as their own, by the key the server sends with
 * each: a staff role's slug, or a starter achievement's key (`starterAchievements`). The name
 * comes from the server, so an achievement keeps its look when editors rename it. One editors
 * add later has no key, and gets the award icon until it has a look of its own.
 */
const BADGES: Record<string, Omit<BadgeLook, "name">> = {
  // Staff roles share the brand color, so staff read as staff at a glance.
  admin: { icon: ShieldCheckIcon, className: "text-brand-text", description: "Site admin" },
  "chief-editor": {
    icon: CrownIcon,
    className: "text-brand-text",
    description: "Pragmatic Papers' chief editor",
  },
  editor: {
    icon: SquarePenIcon,
    className: "text-brand-text",
    description: "Pragmatic Papers editor",
  },
  writer: {
    icon: PenLineIcon,
    className: "text-brand-text",
    description: "Writes for Pragmatic Papers",
  },
  narrator: {
    icon: MicIcon,
    className: "text-brand-text",
    description: "Narrates Pragmatic Papers articles",
  },
  vouched: {
    icon: BadgeCheckIcon,
    className: "text-blue-500 dark:text-blue-400",
    description: "The editors confirmed who this is",
  },
  verified: {
    icon: MailCheckIcon,
    className: "text-emerald-600 dark:text-emerald-400",
    description: "Verified email address",
  },
  "early-member": {
    icon: MedalIcon,
    className: "text-rose-600 dark:text-rose-400",
    description: "One of the site's first members",
  },
}

const FALLBACK: Omit<BadgeLook, "name"> = {
  icon: AwardIcon,
  className: "text-violet-600 dark:text-violet-400",
}

/** The look of a commenter's own badge, named as the server names it. */
const badgeLook = ({ key, label }: BadgeInfo): BadgeLook => {
  const look = key && Object.hasOwn(BADGES, key) ? BADGES[key] : undefined
  return { ...(look ?? FALLBACK), name: label }
}

/** One badge: a colored icon, named for screen readers, with its name in a tooltip. */
const AuthorBadge: React.FC<{ look: BadgeLook }> = ({
  look: { name, icon: Icon, className, description },
}) => (
  <Tooltip>
    <TooltipTrigger
      render={<span />}
      role="img"
      aria-label={name}
      tabIndex={0}
      className={cn("inline-flex size-4 shrink-0 cursor-default rounded-sm", className)}
    >
      <Icon aria-hidden="true" className="size-full" strokeWidth={2.25} />
    </TooltipTrigger>
    <TooltipContent side="top">{description ? `${name}: ${description}` : name}</TooltipContent>
  </Tooltip>
)

/**
 * The badges beside a commenter's name: Writer, then the markers that come and go (Cake day on an
 * account's anniversary, First comment on someone's first, New commenter for a week after it, New
 * member for a new account's first month), then their own badge.
 */
export const AuthorBadges: React.FC<{
  author: Pick<AuthorDisplay, "badge" | "writer" | "newcomer" | "newMember" | "cakeDay">
  /** The comment is its author's first on the site. */
  firstComment?: boolean
}> = ({ author, firstComment = false }) => {
  const looks = [
    author.writer && WRITER,
    author.cakeDay && CAKE_DAY,
    firstComment && FIRST_COMMENT,
    author.newcomer && NEW_COMMENTER,
    author.newMember && NEW_MEMBER,
    author.badge && badgeLook(author.badge),
  ].filter((look): look is BadgeLook => Boolean(look))
  if (looks.length === 0) return null
  return (
    <span className="inline-flex items-center gap-1">
      {looks.map((look) => (
        <AuthorBadge key={look.name} look={look} />
      ))}
    </span>
  )
}
