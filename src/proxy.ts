import { type NextRequest, NextResponse } from "next/server"

// A Server Action ID as Next 16 checks it before looking the action up: exactly 42
// characters (SERVER_REFERENCE_ID_LENGTH, `mightBeServerReferenceId` in
// next/dist/shared/lib/server-reference-info.js), hex-encoded — one info byte plus a
// SHA-1. Anything else makes Next throw "The Server Reference ID did not match the
// expected format" and log a stack trace. Scanners probing for the late-2025 Server
// Components vulnerability send short values like "x", so turn them away here (#1107).
// A well-formed ID from an older deploy still reaches Next, which answers it itself.
const SERVER_ACTION_ID = /^[0-9a-f]{42}$/i

export function proxy(request: NextRequest): ReturnType<typeof NextResponse.next> {
  const actionId = request.headers.get("next-action")
  if (actionId !== null && !SERVER_ACTION_ID.test(actionId)) {
    return new NextResponse(null, { status: 404 })
  }

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
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api|monitoring).*)"],
}
