import { ChevronRight } from "lucide-react"
import Link from "next/link"
import React from "react"

import { Breadcrumbs, type Crumb } from "@/components/Breadcrumbs"
import { DEFAULT_DOC_SECTION, docNavTitle, type DocsSection } from "@/plugins/docs/sections"
import { cn } from "@/utilities/utils"

export interface DocsNavItem {
  slug?: string | null
  title: string
  navTitle?: string | null
}

interface DocsNavProps {
  sections: DocsSection<DocsNavItem>[]
  /** The open doc's slug; left out on the /docs index. */
  current?: string
  className?: string
}

/** Every doc under its section, like a wiki's sidebar; each section folds. */
export function DocsNav({ sections, current, className }: DocsNavProps): React.ReactNode {
  // Only one section starts open: the open doc's, or Getting started on the index.
  const currentSection = sections.find((section) =>
    section.docs.some((doc) => doc.slug === current),
  )?.value
  const openSection = currentSection ?? DEFAULT_DOC_SECTION
  return (
    <nav aria-label="Docs" className={cn("font-sans", className)}>
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
      {sections.map((section) => {
        return (
          <details key={section.value} open={section.value === openSection} className="group mt-5">
            <summary
              id={`docs-nav-${section.value}`}
              className={cn(
                "hover:text-foreground mb-2 flex cursor-pointer list-none items-center gap-1 text-sm font-bold tracking-wider uppercase [&::-webkit-details-marker]:hidden",
                // The open doc's section reads as hovered, so the reader sees where they are.
                section.value === currentSection ? "text-foreground" : "text-muted-foreground",
              )}
            >
              <ChevronRight
                aria-hidden="true"
                className="size-4 shrink-0 transition-transform group-open:rotate-90"
              />
              {section.label}
            </summary>
            <ul
              aria-labelledby={`docs-nav-${section.value}`}
              className="border-border ml-2 border-l-2"
            >
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
                      {docNavTitle(doc)}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </details>
        )
      })}
    </nav>
  )
}

interface DocsLayoutProps extends DocsNavProps {
  children: React.ReactNode
  /** The page's breadcrumb trail, shown above it in the page's column. */
  breadcrumbs?: Crumb[]
}

/**
 * The docs' two columns: the sidebar on the left from `lg`, sticky and scrolling on its own, and
 * after the page on narrower screens, so a phone opens on the doc rather than the list.
 */
export function DocsLayout({
  children,
  breadcrumbs = [],
  className,
  ...nav
}: DocsLayoutProps): React.ReactNode {
  return (
    <div
      className={cn(
        "mx-auto grid max-w-7xl gap-10 px-4 pb-16 lg:grid-cols-[15rem_minmax(0,1fr)]",
        // Docs are reference pages: their headings, the doc's own included, are in the body's
        // sans rather than the site's display face. It isn't condensed, so they're a size
        // smaller than the site's and bold to stand out from the text.
        "[&_:is(h1,h2,h3,h4,h5,h6)]:font-sans [&_:is(h1,h2,h3,h4,h5,h6)]:leading-tight [&_:is(h1,h2,h3,h4,h5,h6)]:font-bold [&_:is(h1,h2,h3,h4,h5,h6)]:tracking-tight",
        "[&_h1]:text-3xl md:[&_h1]:text-4xl [&_h2]:text-2xl md:[&_h2]:text-[1.75rem] [&_h3]:text-xl [&_h4]:text-lg",
        className,
      )}
    >
      <DocsNav
        {...nav}
        className="order-last border-t pt-6 lg:sticky lg:top-(--sticky-top) lg:order-first lg:max-h-[calc(100vh-var(--sticky-top))] lg:[scrollbar-width:thin] lg:[scrollbar-gutter:stable] lg:self-start lg:overflow-y-auto lg:border-t-0 lg:pt-0 lg:pr-4 lg:pb-4"
      />
      <div className="min-w-0">
        <Breadcrumbs items={breadcrumbs} className="mx-0 max-w-none px-0" />
        {children}
      </div>
    </div>
  )
}
