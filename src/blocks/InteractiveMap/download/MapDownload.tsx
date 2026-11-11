"use client"

import { DownloadIcon } from "lucide-react"
import React, { createContext, useContext, useRef, useState } from "react"

import { Button } from "@/components/ui/button"
import type { MapDrawing } from "../converters"

type Drawing = Omit<MapDrawing, "footer" | "fontFaces"> & { sources?: readonly string[] }

const MapDownloadContext = createContext<Drawing | null>(null)

/** Gives a `DownloadMapButton` under it the block it draws. */
export function MapDownloadProvider({
  drawing,
  children,
}: {
  drawing: Drawing
  children: React.ReactNode
}): React.ReactNode {
  return <MapDownloadContext.Provider value={drawing}>{children}</MapDownloadContext.Provider>
}

/**
 * Saves the map as a PNG, with its title, legend, sources and the logo, for readers to share.
 * Renders nothing outside a `MapDownloadProvider`. The drawing code loads on the first click.
 */
export function DownloadMapButton({ className }: { className?: string }): React.ReactNode {
  const drawing = useContext(MapDownloadContext)
  const ref = useRef<HTMLButtonElement>(null)
  const [busy, setBusy] = useState(false)
  if (!drawing) return null

  async function download() {
    setBusy(true)
    try {
      const { downloadMapImage } = await import("./downloadMapImage")
      const logo = ref.current
        ?.closest("[data-interactive-map-block]")
        ?.querySelector("[data-map-logo] svg")
      await downloadMapImage({ ...drawing!, logo: logo ?? null })
    } catch (error) {
      console.error("Could not download the map", error)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Button
      ref={ref}
      type="button"
      variant="ghost"
      size="icon-xs"
      aria-label="Download map as an image"
      title="Download map as an image"
      disabled={busy}
      onClick={download}
      className={className}
    >
      <DownloadIcon className="size-3.5" />
    </Button>
  )
}
