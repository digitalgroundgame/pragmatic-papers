"use client"
import dynamic from "next/dynamic"

// The map engine loads only on pages with a map.
export const InteractiveMapClient = dynamic(() =>
  import("./InteractiveMapClient").then((m) => m.InteractiveMapClient),
)
