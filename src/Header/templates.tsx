"use client"

import { usePathname } from "next/navigation"
import type React from "react"

/**
 * The headers a page can wear: `default` is the site's (main nav, mega menu, ticker, actions,
 * centered logo); `minimal` is a left-aligned logo with a few links and the theme toggle, for
 * pages that bring their own navigation.
 */
export type HeaderTemplate = "default" | "minimal"

/**
 * The routes that wear a header other than the default, by path: a route matches its own path
 * and everything under it. A route opts in by adding itself here.
 */
export const HEADER_TEMPLATES: readonly { path: string; template: HeaderTemplate }[] = [
  // The docs have their own sidebar, so the site's nav would only compete with it.
  { path: "/docs", template: "minimal" },
]

/** The header the page at `pathname` wears. */
export function headerTemplateFor(pathname: string | null): HeaderTemplate {
  if (!pathname) return "default"
  const route = HEADER_TEMPLATES.find(
    ({ path }) => pathname === path || pathname.startsWith(`${path}/`),
  )
  return route?.template ?? "default"
}

/**
 * Shows the header for the current route. The root layout renders every template on the server
 * and hands them in, since a layout can't see the path; this picks one, so only that one reaches
 * the page's HTML, and a client-side navigation swaps it without a round trip.
 */
export function HeaderTemplateSwitch({
  templates,
}: {
  templates: Record<HeaderTemplate, React.ReactNode>
}): React.ReactNode {
  return templates[headerTemplateFor(usePathname())]
}
