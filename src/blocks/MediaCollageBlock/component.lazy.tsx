"use client"
import dynamic from "next/dynamic"

// The collage and its lightbox load only on pages with a collage.
export const MediaCollageBlock = dynamic(() =>
  import("./component").then((m) => m.MediaCollageBlock),
)
