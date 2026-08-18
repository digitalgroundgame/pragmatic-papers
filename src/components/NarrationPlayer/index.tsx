"use client"

import type { User } from "@/payload-types"
import React from "react"

import { Media, type AudioMediaType } from "@/components/Media"
import { isResolved, type Relationship } from "@/utilities/relationships"

interface NarrationPlayerProps {
  // Callers narrow to audio themselves (see ArticleHero) so a non-audio file is
  // a type error rather than a component that silently renders nothing.
  narration: AudioMediaType
}

interface NarratorCredit {
  name: string
  slug: string
}

/**
 * An unresolved narrator (query depth too low) and a resolved narrator missing
 * its name/slug are different failures — the first is a bug, the second is a
 * content gap — so both get logged rather than dropping the credit silently.
 */
function getNarratorCredit(narrator: Relationship<User>): NarratorCredit | null {
  if (narrator === null || narrator === undefined) return null

  if (!isResolved(narrator)) {
    console.warn(
      `NarrationPlayer: narrator ${narrator} was not resolved — query the narration media at a depth that populates it to render the credit.`,
    )
    return null
  }

  const { name, slug } = narrator
  if (!name || !slug) {
    console.warn(
      `NarrationPlayer: narrator ${narrator.id} is missing ${!name ? "a name" : "a slug"} — omitting the narration credit.`,
    )
    return null
  }

  return { name, slug }
}

export function NarrationPlayer({ narration }: NarrationPlayerProps): React.ReactNode {
  const narrator = getNarratorCredit(narration.narrator)

  return (
    <div className="flex flex-col gap-1.5">
      {narrator && (
        <p className="text-muted-foreground font-serif text-sm">
          Narrated by{" "}
          <a href={`/authors/${narrator.slug}`} className="hover:underline">
            {narrator.name}
          </a>
        </p>
      )}
      <Media media={narration} />
    </div>
  )
}
