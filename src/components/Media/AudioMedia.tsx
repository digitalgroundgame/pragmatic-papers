"use client"

import { cva, type VariantProps } from "class-variance-authority"
import { Pause, Play, Settings, Volume1, Volume2, VolumeX } from "lucide-react"
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

// Inverse of the controls: the call to action is what the collapsed player
// shows, and it clears out as the scrubber takes the row.
const audioLabelVariants = cva("shrink-0 overflow-hidden font-serif text-sm whitespace-nowrap", {
  variants: {
    variant: {
      default: "",
      collapsible:
        "transition-[max-width,opacity,margin] duration-500 ease-out motion-reduce:transition-none",
    },
    expanded: {
      true: "ml-0 max-w-0 opacity-0",
      false: "ml-2 max-w-48 opacity-100",
    },
  },
  defaultVariants: {
    variant: "default",
    expanded: true,
  },
})

const PLAYBACK_RATES = [0.75, 1, 1.25, 1.5, 2] as const

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

  const listenLabel = duration > 0 ? `Listen \u00b7 ${formatTime(duration)}` : "Listen"

  return (
    <div className="flex items-center">
      <button
        onClick={togglePlay}
        aria-label={isPlaying ? "Pause" : "Play"}
        className="text-primary hover:text-primary/70 flex shrink-0 items-center transition-colors"
      >
        {isPlaying ? <Pause className="size-5" /> : <Play className="size-5" />}
        {variant === "collapsible" ? (
          <span aria-hidden className={audioLabelVariants({ variant, expanded })}>
            {listenLabel}
          </span>
        ) : null}
      </button>
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
        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label="Player settings"
            className="text-muted-foreground hover:text-foreground shrink-0 transition-colors"
          >
            <Settings className="size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-auto min-w-40">
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
        </DropdownMenu>
      </div>
      <audio ref={audioRef} src={media.url} preload="metadata" />
    </div>
  )
}
