"use client"

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Home } from "lucide-react"
import { useSelectedLayoutSegments } from "next/navigation"
import { Fragment, type ReactElement } from "react"

const formatBreadcrumbLabel = (segment: string): string => {
  return decodeURIComponent(segment)
    .split("-")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ")
}

const getSegmentHref = (segments: string[], index: number): string =>
  `/${segments.slice(0, index + 1).join("/")}`

const getSegmentItems = (segments: string[]) =>
  segments.map((segment, index) => ({
    href: getSegmentHref(segments, index),
    label: formatBreadcrumbLabel(segment),
  }))

export const Breadcrumbs = (): ReactElement | null => {
  const segments = useSelectedLayoutSegments()

  // if there are no segments, we're on the homepage, so we don't need to render breadcrumbs
  // if the first segment is "articles", we also want to avoid rendering breadcrumbs
  if (segments.length === 0 || segments[0] === "articles") return null

  const segmentItems = getSegmentItems(segments)
  const lastSegmentIndex = segmentItems.length - 1

  return (
    <Breadcrumb className="container mb-4 max-w-3xl">
      <BreadcrumbList className="flex-nowrap">
        <BreadcrumbItem>
          <BreadcrumbLink href="/">
            <Home className="size-4" />
            <span className="sr-only">Home</span>
          </BreadcrumbLink>
        </BreadcrumbItem>
        {segmentItems.map(({ href, label }, index) => {
          const isCurrentPage = index === lastSegmentIndex
          return (
            <Fragment key={href}>
              <BreadcrumbSeparator />
              <BreadcrumbItem className={isCurrentPage ? "min-w-0 flex-1" : undefined}>
                {isCurrentPage ? (
                  <BreadcrumbPage className="block max-w-full min-w-0 truncate">
                    {label}
                  </BreadcrumbPage>
                ) : (
                  <BreadcrumbLink href={href}>{label}</BreadcrumbLink>
                )}
              </BreadcrumbItem>
            </Fragment>
          )
        })}
      </BreadcrumbList>
    </Breadcrumb>
  )
}
