import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/utilities/utils"
import { queryPageBySlug, queryTopicBySlug, queryUserBySlug } from "@/utilities/queries"
import { toRoman } from "@/utilities/toRoman"
import { Home } from "lucide-react"
import { headers } from "next/headers"
import { Fragment, Suspense, type ReactElement } from "react"

const STATIC_ROOTS = new Set(["authors", "topics", "volumes"])

/**
 * Sections whose pages fill the container rather than a column of prose. The trail lines up
 * with what it sits above, so on those it is as wide as the page and everywhere else it stops
 * where the reading column does.
 */
const FULL_WIDTH_ROOTS = new Set(["interactives"])

const widthFor = (segments: string[]): string =>
  segments[0] && FULL_WIDTH_ROOTS.has(segments[0]) ? "container" : "container max-w-3xl"

const formatBreadcrumbLabel = (segment: string): string => {
  return decodeURIComponent(segment)
    .split("-")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ")
}

const getSegmentHref = (segments: string[], index: number): string =>
  `/${segments.slice(0, index + 1).join("/")}`

async function getSegmentLabel(
  segment: string,
  parent: string | undefined,
  index: number,
): Promise<string> {
  const label = formatBreadcrumbLabel(segment)
  if (parent === "authors") return (await queryUserBySlug(segment))?.name || label
  if (parent === "topics") return (await queryTopicBySlug(segment))?.name || label
  if (parent === "volumes") return `Volume ${toRoman(Number(segment))}`
  if (index === 0 && !STATIC_ROOTS.has(segment))
    return (await queryPageBySlug(segment))?.title || label
  return label
}

async function BreadcrumbsRoot({ pathname }: { pathname: string }): Promise<ReactElement | null> {
  const segments = pathname.split("/").filter(Boolean)

  const segmentItems = await Promise.all(
    segments.map(async (segment, index) => {
      const parent = index > 0 ? segments[index - 1] : undefined
      const label = await getSegmentLabel(segment, parent, index)
      return { href: getSegmentHref(segments, index), label }
    }),
  )

  return (
    <Breadcrumb className={cn("mb-4", widthFor(segments))}>
      <BreadcrumbList className="flex-nowrap">
        <BreadcrumbItem>
          <BreadcrumbLink href="/">
            <Home className="size-4" />
            <span className="sr-only">Home</span>
          </BreadcrumbLink>
        </BreadcrumbItem>
        {segmentItems.map(({ href, label }, index) => {
          const isCurrentPage = index === segmentItems.length - 1
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

function BreadcrumbsSkeleton({ segments }: { segments: string[] }): ReactElement {
  return (
    <div className={cn("mb-4", widthFor(segments))}>
      <div className="flex flex-nowrap items-center gap-1.5">
        <Skeleton className="size-4 rounded-sm" />
        <Skeleton className="size-3.5 rounded-sm" />
        <Skeleton className="h-5 w-16 rounded" />
        <Skeleton className="size-3.5 rounded-sm" />
        <Skeleton className="h-5 w-28 rounded" />
      </div>
    </div>
  )
}

export async function Breadcrumbs(): Promise<ReactElement | null> {
  const headersList = await headers()
  const pathname = headersList.get("x-pathname") ?? "/"
  const segments = pathname.split("/").filter(Boolean)

  if (segments.length === 0 || segments[0] === "articles") return null

  return (
    <Suspense fallback={<BreadcrumbsSkeleton segments={segments} />}>
      <BreadcrumbsRoot pathname={pathname} />
    </Suspense>
  )
}
