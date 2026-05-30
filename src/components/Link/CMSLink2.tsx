import type { LinkField } from "@/payload-types"
import { getLinkFieldUrl } from "@/utilities/getLinkFieldUrl"
import { HoverPrefetchLink } from "./HoverPrefetchLink"

interface CMSLinkProps extends React.ComponentProps<"a"> {
  link?: LinkField
}

// Planning to replace the CMSLink component with this one in the future.
// Need to add appearance handling before replacing. Use class-variance-authority for handling sizes and variants.

/**
 * CMSLink: A flexible link component for CMS-driven navigation.
 *
 * This component chooses the appropriate element for a given CMS link:
 * - For 'reference' links, uses HoverPrefetchLink (enabling Next.js client-side prefetching on hover).
 * - For 'custom' links (external or manually-entered URLs), renders as a plain <a>.
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
  const url = getLinkFieldUrl(link)
  if (!url) return null
  const Slot = link.type === "custom" ? "a" : HoverPrefetchLink
  return (
    <Slot
      href={url}
      target={link?.newTab ? "_blank" : undefined}
      rel={link?.newTab ? "noopener noreferrer" : undefined}
      {...props}
    >
      {children || link?.label}
    </Slot>
  )
}
