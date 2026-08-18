"use client"

import { cva, type VariantProps } from "class-variance-authority"
import { Pause, Play, Volume1, Volume2, VolumeX } from "lucide-react"
import React, { useCallback, useEffect, useRef, useState } from "react"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Slider } from "@/components/ui/slider"
import type { AudioMediaType } from "./types"

const audioControlsVariants = cva("flex min-w-0 basis-0 items-center gap-3 overflow-hidden", {
  variants: {
    variant: {
      default: "",
      collapsible:
        "transition-[flex-grow,opacity] duration-500 ease-out motion-reduce:transition-none",
    },
    expanded: {
      true: "grow opacity-100",
      false: "grow-0 opacity-0",
    },
  },
  defaultVariants: {
    variant: "default",
    expanded: true,
  },
})

const PLAYBACK_RATES = [0.75, 1, 1.25, 1.5, 2] as const

/** How long a touch has to rest on the play button before settings open. */
const LONG_PRESS_MS = 500

function formatRate(rate: number): string {
  return `${rate}\u00d7`
}

function VolumeIcon({ volume }: { volume: number }): React.ReactNode {
  if (volume === 0) return <VolumeX className="size-4" />
  return volume < 0.5 ? <Volume1 className="size-4" /> : <Volume2 className="size-4" />
}

function formatTime(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return "0:00"
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, "0")}`
}

export interface AudioMediaProps extends Pick<
  VariantProps<typeof audioControlsVariants>,
  "variant"
> {
  media: AudioMediaType
  onDurationChange?: (duration: number) => void
  /** Extra entries appended to the settings menu, below the playback speed group. */
  menuItems?: React.ReactNode
}

export const AudioMedia: React.FC<AudioMediaProps> = ({
  media,
  onDurationChange,
  menuItems,
  variant = "default",
}) => {
  const audioRef = useRef<HTMLAudioElement>(null)
  const durationRef = useRef(media.duration ?? 0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(media.duration ?? 0)
  const [started, setStarted] = useState(false)
  const [playbackRate, setPlaybackRate] = useState(1)
  const [volume, setVolume] = useState(1)
  const [menuOpen, setMenuOpen] = useState(false)
  const longPressRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // A long press ends in a click on the trigger, which would otherwise both
  // toggle playback and immediately close the menu it just opened. The flag is
  // cleared when the next press starts rather than by whichever handler reads
  // it first, so it does not depend on their firing order.
  const swallowClickRef = useRef(false)
  const expanded = variant !== "collapsible" || started

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    let seeking = false

    const onTimeUpdate = () => {
      if (seeking) return
      setCurrentTime(audio.currentTime)
    }
    const handleDurationChange = () => {
      if (!isFinite(audio.duration)) return
      durationRef.current = audio.duration
      setDuration(audio.duration)
      if (seeking) {
        seeking = false
        audio.currentTime = 0
      }
    }
    const onEnded = () => {
      setIsPlaying(false)
      setCurrentTime(durationRef.current)
      setStarted(false)
    }

    const tryCaptureDuration = () => {
      if (isFinite(audio.duration)) {
        durationRef.current = audio.duration
        setDuration(audio.duration)
      } else if (durationRef.current === 0) {
        // No stored duration and header reports Infinity — seek past end to
        // force the browser to find the real end and re-fire durationchange.
        seeking = true
        audio.currentTime = 1e9
      }
    }

    if (audio.readyState >= 1) tryCaptureDuration()

    audio.addEventListener("timeupdate", onTimeUpdate)
    audio.addEventListener("durationchange", handleDurationChange)
    audio.addEventListener("loadedmetadata", tryCaptureDuration)
    audio.addEventListener("ended", onEnded)

    return () => {
      audio.removeEventListener("timeupdate", onTimeUpdate)
      audio.removeEventListener("durationchange", handleDurationChange)
      audio.removeEventListener("loadedmetadata", tryCaptureDuration)
      audio.removeEventListener("ended", onEnded)
    }
  }, [])

  useEffect(() => {
    if (duration > 0) onDurationChange?.(duration)
  }, [duration, onDurationChange])

  useEffect(() => {
    if (audioRef.current) audioRef.current.playbackRate = playbackRate
  }, [playbackRate])

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume
  }, [volume])

  const togglePlay = useCallback(() => {
    if (swallowClickRef.current) return
    const audio = audioRef.current
    if (!audio) return
    if (isPlaying) {
      audio.pause()
      setIsPlaying(false)
    } else {
      setStarted(true)
      void audio
        .play()
        .then(() => setIsPlaying(true))
        .catch(() => setIsPlaying(false))
    }
  }, [isPlaying])

  const cancelLongPress = useCallback(() => {
    if (longPressRef.current === null) return
    clearTimeout(longPressRef.current)
    longPressRef.current = null
  }, [])

  useEffect(() => cancelLongPress, [cancelLongPress])

  const startLongPress = useCallback(
    (event: React.PointerEvent) => {
      // Secondary buttons already have onContextMenu; only the primary pointer
      // arms the hold-to-open timer.
      if (event.button > 0) return
      swallowClickRef.current = false
      cancelLongPress()
      longPressRef.current = setTimeout(() => {
        swallowClickRef.current = true
        setMenuOpen(true)
      }, LONG_PRESS_MS)
    },
    [cancelLongPress],
  )

  // Fires for right-click and for the keyboard's context-menu key / Shift+F10,
  // which is what keeps the menu reachable without a pointer.
  const handleContextMenu = useCallback((event: React.MouseEvent) => {
    event.preventDefault()
    setMenuOpen(true)
  }, [])

  const handleVolumeChange = useCallback((value: number | readonly number[]) => {
    const next = Array.isArray(value) ? value[0] : value
    if (next === undefined) return
    setVolume(next)
  }, [])

  const handleSeek = useCallback((value: number | readonly number[]) => {
    const audio = audioRef.current
    const newTime = Array.isArray(value) ? value[0] : value
    if (!audio || newTime === undefined) return
    audio.currentTime = newTime
    setCurrentTime(newTime)
  }, [])

  if (!media.url) return null

  return (
    <DropdownMenu
      open={menuOpen}
      onOpenChange={(open, details) => {
        // A plain press plays; settings open from a long press, a right-click,
        // or the context-menu key, so the trigger's own press is ignored — both
        // to open, and to close the menu a long press has just opened.
        if (details.reason === "trigger-press" && (open || swallowClickRef.current)) return
        setMenuOpen(open)
      }}
    >
      <div className="flex items-center">
        <DropdownMenuTrigger
          onClick={togglePlay}
          onPointerDown={startLongPress}
          onPointerUp={cancelLongPress}
          onPointerLeave={cancelLongPress}
          onPointerCancel={cancelLongPress}
          onContextMenu={handleContextMenu}
          aria-label={isPlaying ? "Pause" : "Play"}
          className="text-primary hover:text-primary/70 shrink-0 transition-colors"
        >
          {isPlaying ? <Pause className="size-5" /> : <Play className="size-5" />}
        </DropdownMenuTrigger>
        <div
          data-slot="audio-controls"
          inert={!expanded}
          className={audioControlsVariants({ variant, expanded })}
        >
          <Slider
            className="ml-3"
            min={0}
            max={duration || 100}
            value={[currentTime]}
            onValueChange={handleSeek}
            aria-label="Seek"
          />
          <span className="text-muted-foreground shrink-0 text-xs whitespace-nowrap tabular-nums">
            {`${formatTime(currentTime)} / ${formatTime(duration)}`}
          </span>
        </div>
        <DropdownMenuContent align="start" className="w-auto min-w-40">
          <DropdownMenuGroup>
            <DropdownMenuLabel>Speed</DropdownMenuLabel>
            <DropdownMenuRadioGroup
              value={playbackRate}
              onValueChange={(value) => setPlaybackRate(Number(value))}
            >
              {PLAYBACK_RATES.map((rate) => (
                <DropdownMenuRadioItem key={rate} value={rate}>
                  {formatRate(rate)}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuLabel>Volume</DropdownMenuLabel>
            {/* Not a menu item: the wrapper keeps arrow keys on the slider
                instead of letting the menu use them to move between items. */}
            <div
              className="flex items-center gap-2 px-1.5 py-1"
              onKeyDown={(event) => event.stopPropagation()}
            >
              <VolumeIcon volume={volume} />
              <Slider
                min={0}
                max={1}
                step={0.01}
                value={[volume]}
                onValueChange={handleVolumeChange}
                aria-label="Volume"
                className="w-28"
              />
            </div>
          </DropdownMenuGroup>
          {menuItems ? (
            <>
              <DropdownMenuSeparator />
              {menuItems}
            </>
          ) : null}
        </DropdownMenuContent>
        <audio ref={audioRef} src={media.url} preload="metadata" />
      </div>
    </DropdownMenu>
  )
}
