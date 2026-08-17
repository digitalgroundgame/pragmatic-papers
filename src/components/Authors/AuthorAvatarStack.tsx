import type { User } from "@/payload-types"

import {
  Avatar,
  AvatarFallback,
  AvatarGroup,
  AvatarGroupCount,
  AvatarImage,
} from "@/components/ui/avatar"
import { HoverPrefetchLink } from "@/components/Link/HoverPrefetchLink"
import { getInitials } from "@/utilities/getInitials"
interface AuthorAvatarStackProps {
  authors: User[]
  maxVisible?: number
}

function getThumbnailUrl(author: User): string | undefined {
  if (!author.profileImage) return undefined
  if (typeof author.profileImage === "number") return undefined
  return author.profileImage.sizes?.square?.url ?? undefined
}

export function AuthorAvatarStack({
  authors,
  maxVisible = 3,
}: AuthorAvatarStackProps): React.ReactNode {
  if (!authors.length) return null

  const visible = authors.slice(0, maxVisible)
  const overflow = authors.length - maxVisible

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
      {overflow > 0 && <AvatarGroupCount>+{overflow}</AvatarGroupCount>}
    </AvatarGroup>
  )
}
