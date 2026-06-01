import type { PopulatedAuthors } from "@/payload-types"

import {
  Avatar,
  AvatarFallback,
  AvatarGroup,
  AvatarGroupCount,
  AvatarImage,
} from "@/components/ui/avatar"
import { getInitials } from "@/utilities/getInitials"

const MAX_VISIBLE = 3

interface AuthorAvatarStackProps {
  authors: NonNullable<PopulatedAuthors>
}

export function AuthorAvatarStack({ authors }: AuthorAvatarStackProps): React.ReactNode {
  if (!authors.length) return null

  const visible = authors.slice(0, MAX_VISIBLE)
  const overflow = authors.length - MAX_VISIBLE

  return (
    <AvatarGroup className="*:transition-[margin-left] hover:space-x-1">
      {visible.map((author) => {
        const profileImage = author.profileImage
        const profileImageUrl =
          profileImage && typeof profileImage !== "number"
            ? (profileImage.sizes?.square?.url ?? undefined)
            : undefined
        const initials = getInitials(author.name || "A")

        return (
          <Avatar key={author.id} size="sm">
            <AvatarImage src={profileImageUrl} />
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
        )
      })}
      {overflow > 0 && <AvatarGroupCount>+{overflow}</AvatarGroupCount>}
    </AvatarGroup>
  )
}
