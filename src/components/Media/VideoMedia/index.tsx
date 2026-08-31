"use client"

import React, { useEffect, useRef } from "react"

import { getMediaUrl } from "@/utilities/getMediaUrl"
import type { VideoMediaType } from "../types"

export interface VideoMediaProps {
  className?: string
  onClick?: React.MouseEventHandler<HTMLVideoElement>
  media: VideoMediaType
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
