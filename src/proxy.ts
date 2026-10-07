import { type NextRequest, NextResponse } from "next/server"

// A Server Action ID as Next 16 checks it before looking the action up: exactly 42
// characters (SERVER_REFERENCE_ID_LENGTH, `mightBeServerReferenceId` in
// next/dist/shared/lib/server-reference-info.js), hex-encoded — one info byte plus a
// SHA-1. Anything else makes Next throw "The Server Reference ID did not match the
// expected format" and log a stack trace. Scanners probing for the late-2025 Server
// Components vulnerability send short values like "x", so turn them away here.
// A well-formed ID from an older deploy still reaches Next, which answers it itself.
const SERVER_ACTION_ID = /^[0-9a-f]{42}$/i

// A path segment starting with a dot (/.env, /.git/config, /foo/.aws/credentials) is a
// scanner looking for leaked files. None exist to serve (.dockerignore keeps them out of
// the image), but letting the request through renders the 404 page, samples a trace, and
// Sentry's security detector reads the middleware's pass-through as the file being
// served. /.well-known/ is the one dot path the web defines, so it still reaches Next.
const DOTFILE_SEGMENT = /\/\.(?!well-known(?:\/|$))/

// Next treats every multipart POST to a page as a possible Server Action and parses its
// body. Without a boundary that throws "Failed to parse body as FormData" and the page
// answers 500. Browsers always send the boundary, so only junk requests lack one.
function isMultipartWithoutBoundary(request: NextRequest): boolean {
  if (request.method !== "POST") return false
  const contentType = request.headers.get("content-type")?.toLowerCase() ?? ""
  return contentType.startsWith("multipart/form-data") && !contentType.includes("boundary=")
}

export function proxy(request: NextRequest): ReturnType<typeof NextResponse.next> {
  const actionId = request.headers.get("next-action")
  if (actionId !== null && !SERVER_ACTION_ID.test(actionId)) {
    return new NextResponse(null, { status: 404 })
  }

  if (DOTFILE_SEGMENT.test(request.nextUrl.pathname)) {
    return new NextResponse(null, { status: 404 })
  }

  if (isMultipartWithoutBoundary(request)) {
    return new NextResponse(null, { status: 400 })
  }

  const response = NextResponse.next()

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
