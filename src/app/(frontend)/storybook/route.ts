import { notFound } from "next/navigation"
import { type NextRequest } from "next/server"
import { storybookUrl } from "./storybookUrl"

/**
 * `/storybook` on staging and PR previews is a short link to the Storybook
 * published for that deployment. The live site doesn't advertise it.
 */
export function GET(request: NextRequest): Response {
  if (process.env.BUILD_ENV === "production") notFound()

  // Behind Coolify's proxy, the public host arrives as X-Forwarded-Host.
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host")
  const target = new URL(storybookUrl(host))
  // Keeps deep links: Storybook addresses a story with `?path=/story/...`.
  target.search = request.nextUrl.search

  return Response.redirect(target, 307)
}
