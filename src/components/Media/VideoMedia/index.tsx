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

  // The storage plugin already resolves media.url for wherever the file lives, local
  // or bucket, so this never rebuilds it: a client component can't read S3_BUCKET.
  if (media && typeof media === "object" && media.url) {
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
        <source src={getMediaUrl(media.url, media.updatedAt)} type={media.mimeType} />
      </video>
    )
  }

  return null
}
