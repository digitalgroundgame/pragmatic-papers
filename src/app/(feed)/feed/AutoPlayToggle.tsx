"use client"

import { Button } from "@/components/ui/button"
import { Pause, Play } from "lucide-react"
import React from "react"

interface AutoPlayToggleProps {
  isPlaying: boolean
  onToggle: () => void
}

export function AutoPlayToggle({ isPlaying, onToggle }: AutoPlayToggleProps): React.ReactNode {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={onToggle}
      className="h-8 w-8 shrink-0 rounded-full border border-white/15 bg-white/10 text-white backdrop-blur-md hover:bg-white/20 hover:text-white"
      aria-label={isPlaying ? "Pause auto-play" : "Resume auto-play"}
      aria-pressed={isPlaying}
    >
      {isPlaying ? <Pause className="size-4" /> : <Play className="size-4" />}
    </Button>
  )
}
