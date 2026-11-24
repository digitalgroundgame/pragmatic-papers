import { cn } from "@/utilities/utils"
import type React from "react"

/**
 * The frame every coded page sits in: the container's width, the site's one section rhythm
 * (space-y-6) and the same space above the footer (pb-16). Narrow what should be narrow
 * inside it, with `ReadingColumn`, rather than narrowing the page.
 */
export function PageShell({
  as: Tag = "article",
  align = (process.env.NEXT_PUBLIC_SHELL_ALIGN as "start" | "center" | undefined) ?? "start",
  className,
  children,
  ...props
}: {
  /** The page's element: `article` for a document, `div` for a listing or a tool. */
  as?: "article" | "div" | "section"
  align?: "start" | "center"
} & React.HTMLAttributes<HTMLElement>): React.ReactNode {
  return (
    <Tag
      data-align={align}
      className={cn("group/page container space-y-6 pb-16", className)}
      {...props}
    >
      {children}
    </Tag>
  )
}

/** The width for running text: an article's body, a bio, a form, a list of results. */
export function ReadingColumn({
  as: Tag = "div",
  className,
  children,
  ...props
}: { as?: "div" | "section" } & React.HTMLAttributes<HTMLElement>): React.ReactNode {
  return (
    <Tag className={cn("max-w-2xl group-data-[align=center]/page:mx-auto", className)} {...props}>
      {children}
    </Tag>
  )
}

/**
 * A page's title, at the one h1 size (globals.css sets every h1 to 36 / 48px), with an
 * optional muted line under it and anything else the header holds (a count, an avatar).
 */
export function PageHeader({
  title,
  description,
  eyebrow,
  className,
  children,
}: {
  title: React.ReactNode
  description?: React.ReactNode
  /** A short label above the title, in the serif eyebrow style. */
  eyebrow?: React.ReactNode
  className?: string
  children?: React.ReactNode
}): React.ReactNode {
  return (
    <header className={cn("max-w-2xl space-y-3 group-data-[align=center]/page:mx-auto", className)}>
      {eyebrow && (
        <p className="text-brand-text font-serif text-xs font-semibold tracking-widest uppercase">
          {eyebrow}
        </p>
      )}
      <h1>{title}</h1>
      {description && <p className="text-muted-foreground">{description}</p>}
      {children}
    </header>
  )
}
