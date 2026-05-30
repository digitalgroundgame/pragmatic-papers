"use client"

import { cn } from "@/utilities/utils"
import NextImage, { type ImageProps } from "next/image"
import { useState } from "react"

export const NextImageFade = ({ src, alt, className, ...props }: ImageProps): React.ReactNode => {
  const [loaded, setLoaded] = useState(false)
  return (
    <NextImage
      src={src}
      alt={alt}
      className={cn(
        "transition-opacity duration-300",
        loaded ? "opacity-100" : "opacity-0",
        className,
      )}
      {...props}
      onLoad={() => setLoaded(true)}
    />
  )
}
