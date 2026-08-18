import type { User } from "@/payload-types"
import React from "react"

import { Media, type AudioMediaType } from "@/components/Media"
import { isResolved, type Relationship } from "@/utilities/relationships"

function NarratorCredit({ narrator }: { narrator: Relationship<User> }): React.ReactNode {
  if (!isResolved(narrator)) return null

  const { name, slug } = narrator
  if (!name || !slug) return null

  return (
    <p className="text-muted-foreground font-serif text-sm">
      Narrated by{" "}
      <a href={`/authors/${slug}`} className="hover:underline">
        {name}
      </a>
    </p>
  )
}

interface NarrationPlayerProps {
  narration: AudioMediaType
}

export function NarrationPlayer({ narration }: NarrationPlayerProps): React.ReactNode {
  return (
    <div className="flex flex-col gap-1.5">
      <NarratorCredit narrator={narration.narrator} />
      <Media media={narration} />
    </div>
  )
}
