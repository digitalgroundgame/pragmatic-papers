import { HoverPrefetchLink } from "@/components/Link/HoverPrefetchLink"
import { LazyModeToggle } from "@/components/ModeToggleAnalytics.lazy"
import { LinkButton } from "@/components/ui/link-button"
import { HeaderLogo } from "@/Header/chrome"
import React from "react"

/**
 * The `minimal` header: the logo on the left, beside the docs' name, and on the right a link to
 * What's new and the theme toggle. No main nav, ticker or actions; the docs' sidebar is their
 * navigation. Sticky and as tall as the default header, so `--sticky-top` holds for both.
 */
export function MinimalHeader(): React.JSX.Element {
  return (
    <header className="bg-background sticky top-0 z-50">
      <div className="container">
        <div className="flex items-center justify-between gap-4 border-b py-3">
          <div className="flex min-w-0 items-center gap-3">
            <HoverPrefetchLink
              href="/"
              aria-label="Link to Home"
              className="inline-flex shrink-0 items-center"
            >
              <HeaderLogo />
            </HoverPrefetchLink>
            <span aria-hidden="true" className="bg-border h-6 w-px shrink-0" />
            <HoverPrefetchLink
              href="/docs"
              className="font-sans text-lg font-medium no-underline hover:underline"
            >
              Docs
            </HoverPrefetchLink>
          </div>
          <nav aria-label="Docs links" className="flex items-center gap-1">
            <LinkButton href="/docs/whats-new" variant="ghost" size="sm" className="font-sans">
              What&apos;s new
            </LinkButton>
            <LazyModeToggle location="docs-header" />
          </nav>
        </div>
      </div>
    </header>
  )
}
