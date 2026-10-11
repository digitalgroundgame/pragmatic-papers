"use client"

import Link from "next/link"
import { useState } from "react"

/**
 * Whether links navigate client-side. Set by the Cloudflare Worker build
 * (`withCloudflare`); the Coolify build keeps plain `<a>` links, because Cloudflare's
 * cache in front of it can't tell a page's HTML from the RSC payload next/link fetches
 * for the same URL.
 */
const CLIENT_NAVIGATION = process.env.NEXT_PUBLIC_CLIENT_NAVIGATION === "true"

/**
 * Paths the Worker hands to the Coolify origin (`withOrigin` in src/cloudflare/origin.ts):
 * the admin panel and Payload's API aren't routes of the Worker's app, so next/link
 * can't render them.
 */
const ORIGIN_PATHS = /^\/(admin|api)(\/|$|\?|#)/

/** A same-site path next/link can navigate to, rather than a URL, hash or origin route. */
export function isClientRoute(href: string): boolean {
  return href.startsWith("/") && !href.startsWith("//") && !ORIGIN_PATHS.test(href)
}

/**
 * A link that navigates client-side with next/link where it can, prefetching the
 * destination only once the pointer is over it, and is a plain `<a>` otherwise: in the
 * Coolify build, for URLs off the site, for routes the Worker sends to the origin, and
 * for links that open a new tab.
 */
export const HoverPrefetchLink: React.FC<React.ComponentProps<"a">> = ({
  href,
  onMouseEnter,
  ...props
}) => {
  const [hovered, setHovered] = useState(false)

  if (!CLIENT_NAVIGATION || !href || !isClientRoute(href) || props.target === "_blank") {
    return <a href={href} onMouseEnter={onMouseEnter} {...props} />
  }

  return (
    <Link
      href={href}
      prefetch={hovered ? null : false}
      onMouseEnter={(event) => {
        setHovered(true)
        onMouseEnter?.(event)
      }}
      {...props}
    />
  )
}
