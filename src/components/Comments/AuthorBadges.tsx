"use client"

import {
  AwardIcon,
  BadgeCheckIcon,
  FeatherIcon,
  type LucideIcon,
  ShieldCheckIcon,
  SparklesIcon,
} from "lucide-react"
import React from "react"

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import type { AuthorDisplay } from "@/plugins/comments"
import { cn } from "@/utilities/utils"

interface BadgeLook {
  icon: LucideIcon
  className: string
  /** Said in the tooltip, after the badge's name. */
  description?: string
}

/**
 * How each badge a commenter can carry looks: Staff (from the site), Writer (of the article),
 * and the starter achievements. An achievement editors add later gets the award icon until it
 * has a look of its own here.
 */
const LOOKS: Record<string, BadgeLook> = {
  Writer: {
    icon: FeatherIcon,
    className: "text-blue-600 dark:text-blue-400",
    description: "Wrote this article",
  },
  Staff: {
    icon: ShieldCheckIcon,
    className: "text-brand-text",
    description: "Pragmatic Papers staff",
  },
  Verified: {
    icon: BadgeCheckIcon,
    className: "text-emerald-600 dark:text-emerald-400",
    description: "Verified email address",
  },
  "Early member": {
    icon: SparklesIcon,
    className: "text-amber-500 dark:text-amber-400",
    description: "One of the site's first members",
  },
}

const FALLBACK: BadgeLook = { icon: AwardIcon, className: "text-violet-600 dark:text-violet-400" }

/** One badge: a colored icon, named for screen readers, with its name in a tooltip. */
export const AuthorBadge: React.FC<{ name: string }> = ({ name }) => {
  const { icon: Icon, className, description } = LOOKS[name] ?? FALLBACK
  return (
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
}

/** The badges beside a commenter's name: Writer first, then their own badge. */
export const AuthorBadges: React.FC<{ author: Pick<AuthorDisplay, "badge" | "writer"> }> = ({
  author,
}) => {
  const names = [author.writer ? "Writer" : null, author.badge].filter((name): name is string =>
    Boolean(name),
  )
  if (names.length === 0) return null
  return (
    <span className="inline-flex items-center gap-1">
      {names.map((name) => (
        <AuthorBadge key={name} name={name} />
      ))}
    </span>
  )
}
