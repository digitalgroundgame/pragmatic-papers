"use client"

import type { User } from "@/payload-types"
import React from "react"

import { Media, type AudioMediaType } from "@/components/Media"

// function formatVTTTime(seconds: number): string {
//   const h = Math.floor(seconds / 3600)
//   const m = Math.floor((seconds % 3600) / 60)
//   const s = seconds % 60
//   return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toFixed(3).padStart(6, "0")}`
// }

// function buildWebVTT(transcript: string, duration: number): string {
//   const segments = transcript
//     .split(/\n\n+/)
//     .map((s) => s.replace(/\n/g, " ").trim())
//     .filter(Boolean)

//   if (segments.length === 0) return "WEBVTT\n"

//   const segmentDuration = duration / segments.length
//   const cues = segments.map((text, i) => {
//     const start = formatVTTTime(i * segmentDuration)
//     const end = formatVTTTime((i + 1) * segmentDuration)
//     return `${start} --> ${end}\n${text}`
//   })

//   return `WEBVTT\n\n${cues.join("\n\n")}`
// }

interface NarrationPlayerProps {
  narration: AudioMediaType
}

function isNarrator(narrator: number | User | null | undefined): narrator is User {
  if (!narrator) return false
  if (typeof narrator === "number") return false
  return Boolean(narrator.name && narrator.slug)
}

export function NarrationPlayer({ narration }: NarrationPlayerProps): React.ReactNode {
  return (
    <div className="flex flex-col gap-1.5">
      {isNarrator(narration.narrator) && (
        <p className="text-muted-foreground font-serif text-sm">
          Narrated by{" "}
          <a href={`/authors/${narration.narrator.slug}`} className="hover:underline">
            {narration.narrator.name}
          </a>
        </p>
      )}
      <Media media={narration} />
    </div>
  )
}
