import { type NextRequest, NextResponse } from "next/server"

export function proxy(request: NextRequest): ReturnType<typeof NextResponse.next> {
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set("x-pathname", request.nextUrl.pathname)

  const response = NextResponse.next({ request: { headers: requestHeaders } })

  // Prevent staging (and PR previews) from being search index. Pages
  // stays fully crawlable — so the sitemap and pages can be
  // verified — but is kept out of search indexes via noindex. Crawling is
  // intentionally left allowed (no robots.txt Disallow) so Google can actually
  // fetch the page, process, and then and honor the (new) noindex header.
  if (process.env.BUILD_ENV !== "production") {
    response.headers.set("X-Robots-Tag", "noindex, nofollow")
  }

  return response
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api).*)"],
}
