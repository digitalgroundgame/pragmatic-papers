import Link from "next/link"
import React from "react"

import type { DocsSection } from "@/plugins/docs/sections"
import { cn } from "@/utilities/utils"

export interface DocsNavItem {
  slug?: string | null
  title: string
}

interface DocsNavProps {
  sections: DocsSection<DocsNavItem>[]
  /** The open doc's slug; left out on the /docs index. */
  current?: string
  className?: string
}

/** Every doc under its section, like a wiki's sidebar. */
export function DocsNav({ sections, current, className }: DocsNavProps): React.ReactNode {
  return (
    <nav aria-label="Docs" className={cn("font-serif", className)}>
      <Link
        href="/docs"
        aria-current={current ? undefined : "page"}
        className={cn(
          "block font-bold no-underline underline-offset-4 hover:underline",
          current ? "text-muted-foreground hover:text-foreground" : "text-foreground",
        )}
      >
        All docs
      </Link>
      {sections.map((section) => (
        <div key={section.value} className="mt-6">
          {/* Not a heading: the nav comes before the page's h1. */}
          <p
            id={`docs-nav-${section.value}`}
            className="text-muted-foreground mb-2 text-sm font-bold tracking-wider uppercase"
          >
            {section.label}
          </p>
          <ul aria-labelledby={`docs-nav-${section.value}`} className="border-border border-l-2">
            {section.docs.map((doc) => {
              const active = doc.slug === current
              return (
                <li key={doc.slug}>
                  <Link
                    href={`/docs/${doc.slug}`}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "-ml-0.5 block border-l-2 py-1.5 pl-3 leading-snug no-underline underline-offset-4 hover:underline",
                      active
                        ? "border-brand text-foreground font-bold"
                        : "text-foreground hover:text-foreground/80 border-transparent",
                    )}
                  >
                    {doc.title}
                  </Link>
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </nav>
  )
}

interface DocsLayoutProps extends DocsNavProps {
  children: React.ReactNode
}

/**
 * The docs' two columns: the sidebar on the left from `lg`, sticky and scrolling on its own, and
 * after the page on narrower screens, so a phone opens on the doc rather than the list.
 */
export function DocsLayout({ children, className, ...nav }: DocsLayoutProps): React.ReactNode {
  return (
    <div
      className={cn(
        "mx-auto grid max-w-7xl gap-10 px-4 pb-16 lg:grid-cols-[15rem_minmax(0,1fr)]",
        className,
      )}
    >
      <DocsNav
        {...nav}
        className="order-last border-t pt-6 lg:sticky lg:top-[calc(var(--sticky-top)+1rem)] lg:order-first lg:max-h-[calc(100vh-var(--sticky-top)-2rem)] lg:[scrollbar-width:thin] lg:[scrollbar-gutter:stable] lg:self-start lg:overflow-y-auto lg:border-t-0 lg:pt-2 lg:pr-4"
      />
      <div className="min-w-0">{children}</div>
    </div>
  )
}
