import { HoverPrefetchLink } from "@/components/Link/HoverPrefetchLink"
import React from "react"

import { Breadcrumbs, type Crumb } from "@/components/Breadcrumbs"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import {
  docLineage,
  docNavTitle,
  type DocsNode,
  DOCS_PATH,
  HOME_DOC_SLUG,
  WHATS_NEW_PATH,
} from "@/plugins/docs/sections"
import { cn } from "@/utilities/utils"

export { DocPager } from "./DocPager"

export interface DocsNavItem {
  slug?: string | null
  title: string
  navTitle?: string | null
}

interface DocsNavProps {
  /** The published docs as a tree (`docsTree`): areas, their sections, and their docs. */
  tree: DocsNode<DocsNavItem>[]
  /** The open page: a doc's slug, the home doc's, or What's new's path. */
  current?: string
  className?: string
}

/** A link at the top of the sidebar, above the areas, or a doc at the top of the tree. */
function TopLink({
  href,
  active,
  children,
  className,
}: {
  href: string
  active: boolean
  children: React.ReactNode
  className?: string
}): React.ReactNode {
  return (
    <HoverPrefetchLink
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "block py-1 font-bold underline-offset-4 hover:underline",
        active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
        className,
      )}
    >
      {children}
    </HoverPrefetchLink>
  )
}

/** A section's docs, each indented under its own when docs nest deeper. */
function DocLinks({
  nodes,
  current,
  labelledBy,
  overview,
}: {
  nodes: DocsNode<DocsNavItem>[]
  current?: string
  labelledBy?: string
  /** The section's own page, linked first. */
  overview?: DocsNode<DocsNavItem>
}): React.ReactNode {
  const link = (node: DocsNode<DocsNavItem>, label: React.ReactNode) => {
    const active = node.doc.slug === current
    return (
      <HoverPrefetchLink
        href={node.path}
        aria-current={active ? "page" : undefined}
        className={cn(
          "-ml-0.5 block border-l-2 py-1.5 pl-3 leading-snug underline-offset-4 hover:underline",
          active
            ? "border-brand text-foreground font-bold"
            : "text-foreground hover:text-foreground/80 border-transparent",
        )}
      >
        {label}
      </HoverPrefetchLink>
    )
  }
  return (
    <ul aria-labelledby={labelledBy} className="border-border ml-0.5 border-l-2">
      {overview && <li>{link(overview, "Overview")}</li>}
      {nodes.map((node) => (
        <li key={node.path}>
          {link(node, docNavTitle(node.doc))}
          {node.children.length > 0 && (
            <div className="pl-3">
              <DocLinks nodes={node.children} current={current} />
            </div>
          )}
        </li>
      ))}
    </ul>
  )
}

/** An area: its name, linking to its page, over its sections, each of which folds. */
function DocsArea({
  area,
  current,
  openSection,
}: {
  area: DocsNode<DocsNavItem>
  current?: string
  openSection?: string
}): React.ReactNode {
  const key = area.doc.slug ?? area.path
  const sections = area.children.filter((node) => node.children.length)
  const docs = area.children.filter((node) => !node.children.length)
  return (
    <div className="mt-6">
      <TopLink
        href={area.path}
        active={area.doc.slug === current}
        className="text-foreground hover:text-foreground text-lg"
      >
        <span id={`docs-nav-area-${key}`}>{docNavTitle(area.doc)}</span>
      </TopLink>
      {docs.length > 0 && (
        <div className="mt-2">
          <DocLinks nodes={docs} current={current} labelledBy={`docs-nav-area-${key}`} />
        </div>
      )}
      {sections.length > 0 && (
        <Accordion
          multiple
          // Folded sections stay in the page, so find-in-page and search engines see every doc.
          hiddenUntilFound
          defaultValue={
            openSection && sections.some((section) => section.path === openSection)
              ? [openSection]
              : []
          }
          className="mt-2"
        >
          {sections.map((section) => {
            const id = `docs-nav-${section.doc.slug ?? section.path}`
            const isCurrent = docLineage(section.children, current ?? "").length > 0
            return (
              <AccordionItem
                key={section.path}
                value={section.path}
                className="not-last:border-b-0"
              >
                <AccordionTrigger
                  id={id}
                  className={cn(
                    "hover:text-foreground py-2 font-bold tracking-wider uppercase hover:no-underline",
                    // The open doc's section reads as hovered, so the reader sees where they are.
                    isCurrent || section.doc.slug === current
                      ? "text-foreground"
                      : "text-muted-foreground",
                  )}
                >
                  {docNavTitle(section.doc)}
                </AccordionTrigger>
                <AccordionContent className="pb-2 text-base [&_a]:no-underline">
                  <DocLinks
                    nodes={section.children}
                    current={current}
                    labelledBy={id}
                    overview={section}
                  />
                </AccordionContent>
              </AccordionItem>
            )
          })}
        </Accordion>
      )}
    </div>
  )
}

/**
 * Home and What's new, then the docs' tree, like a wiki's sidebar: each area's name links to its
 * page, over its sections, which fold, each opening on its own page (Overview) and its docs. A
 * doc at the top of the tree with nothing under it is a link of its own.
 */
export function DocsNav({ tree, current, className }: DocsNavProps): React.ReactNode {
  // Only one section starts open: the open doc's, or the first elsewhere.
  const sections = tree.flatMap((area) => area.children.filter((node) => node.children.length))
  const lineage = current ? docLineage(tree, current) : []
  const openSection = (lineage[1]?.children.length ? lineage[1] : sections[0])?.path
  return (
    <nav aria-label="Docs" className={cn("font-sans", className)}>
      <TopLink href={DOCS_PATH} active={current === HOME_DOC_SLUG}>
        Home
      </TopLink>
      <TopLink href={WHATS_NEW_PATH} active={current === WHATS_NEW_PATH}>
        What&apos;s new
      </TopLink>
      {tree.map((node) =>
        node.children.length ? (
          <DocsArea key={node.path} area={node} current={current} openSection={openSection} />
        ) : (
          <TopLink
            key={node.path}
            href={node.path}
            active={node.doc.slug === current}
            className="mt-6"
          >
            {docNavTitle(node.doc)}
          </TopLink>
        ),
      )}
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
        // Clear of the header: the docs' minimal one has no nav row below it to space the page.
        "mx-auto grid max-w-7xl gap-10 px-4 pt-8 pb-16 lg:grid-cols-[15rem_minmax(0,1fr)]",
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
        className="order-last border-t pt-6 lg:sticky lg:top-[calc(var(--sticky-top)+2rem)] lg:order-first lg:max-h-[calc(100vh-var(--sticky-top)-2rem)] lg:[scrollbar-width:thin] lg:[scrollbar-gutter:stable] lg:self-start lg:overflow-y-auto lg:border-t-0 lg:pt-0 lg:pr-4 lg:pb-4"
      />
      <div className="min-w-0">
        <Breadcrumbs items={breadcrumbs} className="mx-0 max-w-none px-0" />
        {children}
      </div>
    </div>
  )
}
