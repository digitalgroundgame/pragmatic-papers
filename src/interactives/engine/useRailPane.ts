"use client"

import { useCallback, useId, useState } from "react"

export interface RailPane {
  /** Null until the reader says anything about the rail; the default is then a question of
   *  screen — beside the map there is room, on a phone it costs a third of the first
   *  screenful. It lives in CSS, so a phone renders folded rather than closing. */
  railChoice: boolean | null
  setRailChoice: React.Dispatch<React.SetStateAction<boolean | null>>
  railOpen: boolean
  railId: string
  /** Closed on arrival: the map is what a reader came for. Choosing a region opens it. */
  paneOpen: boolean
  setPaneOpen: React.Dispatch<React.SetStateAction<boolean>>
  paneId: string
  /** One panel at a time: both open leave a map too narrow to be the thing they are about. */
  showRail(open: boolean): void
  showPane(open: boolean): void
  /** The folded rail's search glyph: a box needs the rail's width, so the glyph unfolds it. */
  unfoldToSearch(): void
}

export function useRailPane(isMobile: boolean): RailPane {
  const [railChoice, setRailChoice] = useState<boolean | null>(null)
  const [paneOpen, setPaneOpen] = useState(false)
  const railOpen = railChoice ?? !isMobile
  const railId = useId()
  const paneId = useId()

  const showRail = useCallback((open: boolean) => {
    setRailChoice(open)
    if (open) setPaneOpen(false)
  }, [])
  const showPane = useCallback((open: boolean) => {
    setPaneOpen(open)
    if (open) setRailChoice(false)
  }, [])
  const unfoldToSearch = useCallback(() => {
    showRail(true)
    // The box is only mounted once the rail is open.
    requestAnimationFrame(() => {
      document
        .getElementById(railId)
        ?.querySelector<HTMLInputElement>("[data-drilldown-search] input")
        ?.focus()
    })
  }, [showRail, railId])

  return {
    railChoice,
    setRailChoice,
    railOpen,
    railId,
    paneOpen,
    setPaneOpen,
    paneId,
    showRail,
    showPane,
    unfoldToSearch,
  }
}
