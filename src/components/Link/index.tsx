import type { LinkField } from "@/payload-types"
import { linkHref } from "@/utilities/linkField"
import { HoverPrefetchLink } from "./HoverPrefetchLink"

interface CMSLinkProps extends React.ComponentProps<"a"> {
  link?: LinkField
}

/**
 * CMSLink: A flexible link component for CMS-driven navigation.
 *
 * This component chooses the appropriate element for a given CMS link:
 * - Renders through HoverPrefetchLink, which navigates client-side to paths on this site
 *   and is a plain <a> for external URLs.
 *
 * Props:
 * - link: (LinkField) The CMS-provided link data object. Required.
 * - children: (ReactNode) Content to show in the link. If not provided, falls back to link.label.
 * - ...props: Remaining anchor-tag props (className, style, etc).
 *
 * Example usage:
 * ```tsx
 *    <CMSLink link={myLink} className="nav-link" />
 *    <CMSLink link={myLink} className="nav-link">Go to Page</CMSLink>
 * ```
 */
export const CMSLink: React.FC<CMSLinkProps> = ({ link, children, ...props }) => {
  if (!link) return null
  const url = linkHref(link)
  if (!url) return null
  return (
    <HoverPrefetchLink
      href={url}
      target={link?.newTab ? "_blank" : undefined}
      rel={link?.newTab ? "noopener noreferrer" : undefined}
      {...props}
    >
      {children || link?.label}
    </HoverPrefetchLink>
  )
}
