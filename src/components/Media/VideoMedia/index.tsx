"use client"

import React, { useEffect, useRef } from "react"

import type { Media } from "@/payload-types"

import { getMediaUrl } from "@/utilities/getMediaUrl"

export interface VideoMediaProps {
  className?: string
  onClick?: () => void
  media: Media & { mimeType: `video/${string}` }
}

export const VideoMedia: React.FC<VideoMediaProps> = (props) => {
  const { onClick, media, className } = props

  const videoRef = useRef<HTMLVideoElement>(null)
  // const [showFallback] = useState<boolean>()

  useEffect(() => {
    const { current: video } = videoRef
    if (video) {
      video.addEventListener("suspend", () => {
        // setShowFallback(true);
        // console.warn('Video was suspended, rendering fallback image.')
      })
    }
  }, [])

  if (media && typeof media === "object") {
    const { filename } = media

    return (
      <video
        autoPlay
        className={className}
        controls={false}
        loop
        muted
        onClick={onClick}
        playsInline
        ref={videoRef}
      >
        <source
          src={getMediaUrl(
            process.env.NODE_ENV === "production"
              ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${process.env.S3_BUCKET}/${filename}`
              : `media/${filename}`,
          )}
        />
      </video>
    )
  }

  return null
}
