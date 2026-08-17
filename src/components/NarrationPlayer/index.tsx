"use client"

import type { Media, User } from "@/payload-types"
import React from "react"

import { AudioMedia, type AudioMediaProps } from "@/components/Media/AudioMedia"

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
  narration: Media
  narrator?: User | null
}

export function NarrationPlayer({ narration, narrator }: NarrationPlayerProps): React.ReactNode {
  // const [duration, setDuration] = useState(narration.duration ?? 0)
  // const [captionSrc, setCaptionSrc] = useState("")

  // useEffect(() => {
  //   if (duration <= 0 || !narration.transcript) return
  //   const vtt = buildWebVTT(narration.transcript, duration)
  //   const blob = new Blob([vtt], { type: "text/vtt" })
  //   const url = URL.createObjectURL(blob)
  //   setCaptionSrc(url)
  //   return () => URL.revokeObjectURL(url)
  // }, [duration, narration.transcript])

  if (!narration.url) return null

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
      <AudioMedia
        media={narration as AudioMediaProps["media"]}
        // captionSrc={captionSrc || undefined}
        // onDurationChange={setDuration}
      />
    </div>
  )
}
