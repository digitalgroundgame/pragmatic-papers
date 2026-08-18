import type { User } from "@/payload-types"
import React from "react"

import { Media, type AudioMediaType } from "@/components/Media"
import {
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu"
import { isResolved, type Relationship } from "@/utilities/relationships"

/**
 * The narrator credit lives in the player's settings menu rather than on its own
 * line, so the whole player fits on one row. It stays a link — the menu item
 * renders as an anchor to the narrator's profile.
 *
 * A plain function rather than a component so an absent credit is `null` at the
 * call site: an element that renders nothing is still truthy, which would leave
 * the menu with a separator and no entries under it.
 */
function narratorCredit(narrator: Relationship<User>): React.ReactNode {
  if (!isResolved(narrator)) return null

  const { name, slug } = narrator
  if (!name || !slug) return null

  return (
    <DropdownMenuGroup>
      <DropdownMenuLabel>Narrated by</DropdownMenuLabel>
      <DropdownMenuItem
        render={<a href={`/authors/${slug}`} />}
        className="cursor-pointer font-serif"
      >
        {name}
      </DropdownMenuItem>
    </DropdownMenuGroup>
  )
}

interface NarrationPlayerProps {
  // Callers narrow to audio themselves (see ArticleHero) so a non-audio file is
  // a type error rather than a component that silently renders nothing.
  narration: AudioMediaType
}

export function NarrationPlayer({ narration }: NarrationPlayerProps): React.ReactNode {
  return (
    <Media media={narration} variant="collapsible" menuItems={narratorCredit(narration.narrator)} />
  )
}
