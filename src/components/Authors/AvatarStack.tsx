import type { User } from "@/payload-types"

import {
  Avatar,
  AvatarFallback,
  AvatarGroup,
  AvatarGroupCount,
  AvatarImage,
} from "@/components/ui/avatar"
import { HoverPrefetchLink } from "@/components/Link/HoverPrefetchLink"
import { MAX_AUTHOR_SLOTS, splitAuthors } from "@/components/Authors/splitAuthors"
import { getInitials } from "@/utilities/getInitials"
interface AvatarStackProps {
  authors: User[]
  /** Total circles to render, counting the "+N" as one of them. */
  maxVisible?: number
  /** When given, the "+N" becomes a button instead of a static badge. */
  onOverflowClick?: () => void
}

function getThumbnailUrl(author: User): string | undefined {
  if (!author.profileImage) return undefined
  if (typeof author.profileImage === "number") return undefined
  return author.profileImage.sizes?.square?.url ?? undefined
}

export function AvatarStack({
  authors,
  maxVisible = MAX_AUTHOR_SLOTS,
  onOverflowClick,
}: AvatarStackProps): React.ReactNode {
  if (!authors.length) return null

  const { visible, overflow } = splitAuthors(authors, maxVisible)

  return (
    <AvatarGroup className="*:[transition:margin-inline-end_50ms_ease-out] hover:space-x-1">
      {visible.map((author, index) => {
        return (
          <Avatar
            key={author.id}
            size="sm"
            style={{ zIndex: visible.length - index }}
            render={
              <HoverPrefetchLink
                href={`/authors/${author.slug}`}
                // The byline repeats every author as a text link to this same
                // page, so announcing the avatar too would read each author
                // twice (WCAG H2). Decorative for AT, clickable for everyone.
                aria-hidden="true"
                tabIndex={-1}
              />
            }
          >
            <AvatarImage src={getThumbnailUrl(author)} />
            <AvatarFallback>{getInitials(author.name || "A")}</AvatarFallback>
          </Avatar>
        )
      })}
      {overflow > 0 &&
        (onOverflowClick ? (
          // Wraps the badge rather than making AvatarGroupCount polymorphic:
          // the badge keeps carrying the size and ring, and the button is a
          // bare flex item, so the stack looks the same either way. It cannot
          // wrap the whole group — the avatars are links, and a link inside a
          // button is not valid HTML.
          <button
            type="button"
            onClick={onOverflowClick}
            aria-expanded={false}
            aria-label={`Show all ${authors.length} authors`}
            className="focus-visible:ring-ring flex cursor-pointer rounded-full p-0 focus-visible:ring-2 focus-visible:outline-none"
          >
            <AvatarGroupCount>+{overflow}</AvatarGroupCount>
          </button>
        ) : (
          <AvatarGroupCount>+{overflow}</AvatarGroupCount>
        ))}
    </AvatarGroup>
  )
}
