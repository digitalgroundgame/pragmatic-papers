// "use client"

// import Link from "next/link"
// import { usePathname } from "next/navigation"
// import { useState } from "react"

/**
 * `HoverPrefetchLink` is a wrapper around Next.js's `Link` component.
 *
 * Feature Summary:
 * - Adds a hover-based prefetching behavior: prefetch is enabled (`null`) only after mouse enter.
 *   Before that, prefetch is explicitly disabled to minimize unnecessary background requests.
 * - Indicates the current page via a "data-active" attribute, based on `pathname.startsWith(href)`.
 * - Applies provided className and other 'a' props to the rendered Link.
 *
 * Usage:
 * ```tsx
 * <HoverPrefetchLink href="/some-path">My Link</HoverPrefetchLink>
 * ```
 *
 * Props:
 * - `href`: string. The link destination, passed directly to Next.js Link.
 * - `children`: ReactNode. Contents of the link.
 * - `className`: string (optional). Additional classes for the anchor element.
 * - All other anchor ('a') tag props are supported.
 *
 * Notes:
 * - Will NOT prefetch on initial render; triggers prefetch on first hover.
 */
export const HoverPrefetchLink: React.FC<React.ComponentProps<"a">> = ({
  href = "",
  children,
  className,
  ...props
}) => {
  // const [active, setActive] = useState(false)
  // const pathname = usePathname()
  // Starts-with matching (e.g. href='/about', pathname='/about/me') for active indication
  // const isCurrent = href === "/" ? pathname === href : pathname.startsWith(href)

  return (
    <a
      href={href}
      className={className}
      {...props}
      // prefetch={active ? null : false}
      // onMouseEnter={() => setActive(true)}
      // data-active={isCurrent}
    >
      {children}
    </a>
  )
}
