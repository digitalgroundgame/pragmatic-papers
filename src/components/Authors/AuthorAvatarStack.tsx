import type { User } from "@/payload-types"

import {
  Avatar,
  AvatarFallback,
  AvatarGroup,
  AvatarGroupCount,
  AvatarImage,
} from "@/components/ui/avatar"
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
    <AvatarGroup className="*:[transition:margin-left_300ms_ease-out] hover:space-x-1">
      {visible.map((author) => {
        return (
          <Avatar key={author.id} size="sm">
            <AvatarImage src={getThumbnailUrl(author)} />
            <AvatarFallback>{getInitials(author.name || "A")}</AvatarFallback>
          </Avatar>
        )
      })}
      {overflow > 0 && <AvatarGroupCount>+{overflow}</AvatarGroupCount>}
    </AvatarGroup>
  )
}
