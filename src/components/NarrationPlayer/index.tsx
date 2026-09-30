import type { User, Media as MediaType } from "@/payload-types"
import React from "react"

import { isAudioMedia, Media } from "@/components/Media"
import { isResolved, type Relationship } from "@/utilities/relationships"

/**
 * The narrator credit lives in the player's settings panel rather than on its own
 * line, so the whole player fits on one row. It stays a link to the narrator's
 * profile.
 *
 * A plain function rather than a component so an absent credit is `null` at the
 * call site: an element that renders nothing is still truthy, which would leave
 * the panel with a separator and nothing above it.
 */
function narratorCredit(narrator: Relationship<User>): React.ReactNode {
  if (!isResolved(narrator)) return null

  const { name, slug } = narrator
  if (!name || !slug) return null

  return (
    <div>
      <p className="text-muted-foreground mb-1 text-xs font-medium">Narrated by</p>
      <a
        href={`/authors/${slug}`}
        className="focus-visible:ring-ring/50 rounded-sm font-serif text-sm outline-none hover:underline focus-visible:ring-3"
      >
        {name}
      </a>
    </div>
  )
}

interface NarrationPlayerProps {
  narration: number | MediaType | null | undefined
  className?: string
}

export function NarrationPlayer({ narration, className }: NarrationPlayerProps): React.ReactNode {
  if (!isAudioMedia(narration)) return null
  return (
    <Media
      media={narration}
      variant="collapsible"
      extraSettings={narratorCredit(narration.narrator)}
      className={className}
    />
  )
}
