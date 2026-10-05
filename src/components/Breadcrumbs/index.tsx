import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { cn } from "@/utilities/utils"
import { Home } from "lucide-react"
import { Fragment, type ReactElement } from "react"

import type { Crumb } from "./trail"

export type { Crumb } from "./trail"
export { nestedDocsTrail } from "./trail"

interface BreadcrumbsProps {
  /** The steps after Home, the current page last. Empty renders nothing. */
  items: Crumb[]
  /**
   * For pages that fill the container rather than a column of prose. The trail lines up with
   * what it sits under, so it is as wide as the page there and stops where the reading column
   * does everywhere else.
   */
  fullWidth?: boolean
}

/**
 * The trail above a page. Each page passes the trail it already knows from the documents it
 * loaded (the same list it gives `buildBreadcrumbJsonLd`), so labels are real titles and nothing
 * is read from the request, which would stop the page being prerendered.
 */
export function Breadcrumbs({ items, fullWidth = false }: BreadcrumbsProps): ReactElement | null {
  if (items.length === 0) return null

  return (
    <Breadcrumb className={cn("mb-4", fullWidth ? "container" : "container max-w-3xl")}>
      <BreadcrumbList className="flex-nowrap">
        <BreadcrumbItem>
          <BreadcrumbLink href="/">
            <Home className="size-4" />
            <span className="sr-only">Home</span>
          </BreadcrumbLink>
        </BreadcrumbItem>
        {items.map(({ name, path }, index) => {
          const isCurrentPage = index === items.length - 1
          return (
            <Fragment key={path}>
              <BreadcrumbSeparator />
              <BreadcrumbItem className={isCurrentPage ? "min-w-0 flex-1" : undefined}>
                {isCurrentPage ? (
                  <BreadcrumbPage className="block max-w-full min-w-0 truncate">
                    {name}
                  </BreadcrumbPage>
                ) : (
                  <BreadcrumbLink href={path}>{name}</BreadcrumbLink>
                )}
              </BreadcrumbItem>
            </Fragment>
          )
        })}
      </BreadcrumbList>
    </Breadcrumb>
  )
}
