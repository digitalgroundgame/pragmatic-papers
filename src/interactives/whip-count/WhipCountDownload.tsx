"use client"

import { DownloadIcon } from "lucide-react"
import React, { useRef, useState } from "react"

import { Button } from "@/components/ui/button"

import type { WhipCountData } from "./model"

/**
 * Saves the public count as a PNG with the logo in its corner, for readers to share. The
 * drawing code, and the map block's code that turns an SVG into a PNG in the page's theme,
 * load on the first click.
 */
export function DownloadWhipCountButton({
  title,
  data,
}: {
  title: string
  data: WhipCountData
}): React.ReactNode {
  const ref = useRef<HTMLButtonElement>(null)
  const [busy, setBusy] = useState(false)

  async function download(): Promise<void> {
    setBusy(true)
    try {
      const [{ drawWhipCountSVG }, map] = await Promise.all([
        import("./picture"),
        import("@/blocks/InteractiveMap/download/downloadMapImage"),
      ])
      const logo =
        ref.current?.closest("[data-whip-count]")?.querySelector("[data-whip-count-logo] svg") ??
        null
      const palette = logo ? map.themePalette(logo) : undefined
      const svg = drawWhipCountSVG({
        title,
        data,
        palette,
        logo: map.logoMarkup(logo, palette?.ink ?? "#171717"),
        fontFaces: await map.fontFaces(),
      })
      await map.saveSVGAsPNG(svg, map.mapFileName(title).replace(/^map\.png$/, "whip-count.png"))
    } catch (error) {
      console.error("Could not download the count", error)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Button
      ref={ref}
      type="button"
      variant="outline"
      size="sm"
      disabled={busy}
      onClick={download}
      className="shrink-0"
    >
      <DownloadIcon className="size-3.5" />
      Download PNG
    </Button>
  )
}
