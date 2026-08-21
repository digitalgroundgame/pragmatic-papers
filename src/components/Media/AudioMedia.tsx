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
import { cn } from "@/utilities/utils"
import { useAudioGain } from "./useAudioGain"
import type { AudioMediaType } from "./types"

const audioControlsVariants = cva("flex min-w-0 items-center gap-3 overflow-hidden", {
  variants: {
    variant: {
      default: "grow basis-0",
      collapsible: "transition-[width,opacity] duration-500 ease-out motion-reduce:transition-none",
    },
    expanded: {
      true: "opacity-100",
      false: "opacity-0",
    },
  },
  compoundVariants: [
    { variant: "collapsible", expanded: true, class: "w-56" },
    { variant: "collapsible", expanded: false, class: "w-0" },
  ],
  defaultVariants: {
    variant: "default",
    expanded: true,
  },
})

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

type AudioVariant = NonNullable<VariantProps<typeof audioControlsVariants>["variant"]>

const PLAYBACK_RATES = [0.75, 1, 1.25, 1.5, 2] as const

function formatRate(rate: number): string {
  return `${rate}\u00d7`
}

function formatTime(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return "0:00"
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, "0")}`
}

function singleValue(value: number | readonly number[]): number | undefined {
  return Array.isArray(value) ? value[0] : (value as number)
}

interface PlayToggleProps {
  isPlaying: boolean
  label: string
  variant: AudioVariant
  expanded: boolean
  onToggle: () => void
}

function PlayToggle({ isPlaying, label, variant, expanded, onToggle }: PlayToggleProps) {
  return (
    <button
      onClick={onToggle}
      aria-label={isPlaying ? "Pause" : "Play"}
      className="text-primary hover:text-primary/70 flex shrink-0 items-center transition-colors"
    >
      {isPlaying ? <Pause className="size-5" /> : <Play className="size-5" />}
      {variant === "collapsible" && (
        <span aria-hidden className={audioLabelVariants({ variant, expanded })}>
          {label}
        </span>
      )}
    </button>
  )
}

interface ScrubberProps {
  currentTime: number
  duration: number
  onSeek: (seconds: number) => void
}

function Scrubber({ currentTime, duration, onSeek }: ScrubberProps) {
  const handleValueChange = useCallback(
    (value: number | readonly number[]) => {
      const seconds = singleValue(value)
      if (seconds !== undefined) onSeek(seconds)
    },
    [onSeek],
  )

  return (
    <>
      <Slider
        className="ml-3"
        min={0}
        max={duration || 100}
        value={[currentTime]}
        onValueChange={handleValueChange}
        aria-label="Seek"
      />
      <span className="text-muted-foreground shrink-0 text-xs whitespace-nowrap tabular-nums">
        {`${formatTime(currentTime)} / ${formatTime(duration)}`}
      </span>
    </>
  )
}

/**
 * Owns the selected rate: nothing outside the menu renders it, so the player
 * only hears about the change it has to apply to the element.
 */
function SpeedMenuGroup({ onChange }: { onChange: (rate: number) => void }) {
  const [playbackRate, setPlaybackRate] = useState(1)

  const handleValueChange = useCallback(
    (value: unknown) => {
      const rate = Number(value)
      setPlaybackRate(rate)
      onChange(rate)
    },
    [onChange],
  )

  return (
    <DropdownMenuGroup>
      <DropdownMenuLabel>Speed</DropdownMenuLabel>
      <DropdownMenuRadioGroup value={playbackRate} onValueChange={handleValueChange}>
        {PLAYBACK_RATES.map((rate) => (
          <DropdownMenuRadioItem key={rate} value={rate}>
            {formatRate(rate)}
          </DropdownMenuRadioItem>
        ))}
      </DropdownMenuRadioGroup>
    </DropdownMenuGroup>
  )
}

function VolumeIcon({ volume }: { volume: number }): React.ReactNode {
  if (volume === 0) return <VolumeX className="size-4" />
  return volume < 0.5 ? <Volume1 className="size-4" /> : <Volume2 className="size-4" />
}

/** Owns the slider position; the level itself is applied by the gain graph upstream. */
function VolumeMenuGroup({ onChange }: { onChange: (volume: number) => void }) {
  const [volume, setVolume] = useState(1)

  const handleValueChange = useCallback(
    (value: number | readonly number[]) => {
      const next = singleValue(value)
      if (next === undefined) return
      setVolume(next)
      onChange(next)
    },
    [onChange],
  )

  return (
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
          onValueChange={handleValueChange}
          aria-label="Volume"
          className="w-28"
        />
      </div>
    </DropdownMenuGroup>
  )
}

interface SettingsMenuProps {
  onPlaybackRateChange: (rate: number) => void
  onVolumeChange: (volume: number) => void
  /** Extra entries appended below the built-in groups. */
  menuItems?: React.ReactNode
}

function SettingsMenu({ onPlaybackRateChange, onVolumeChange, menuItems }: SettingsMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Player settings"
        className="text-muted-foreground hover:text-foreground shrink-0 transition-colors"
      >
        <Settings className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-auto min-w-40">
        <SpeedMenuGroup onChange={onPlaybackRateChange} />
        <DropdownMenuSeparator />
        <VolumeMenuGroup onChange={onVolumeChange} />
        {menuItems ? (
          <>
            <DropdownMenuSeparator />
            {menuItems}
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export interface AudioMediaProps extends Pick<
  VariantProps<typeof audioControlsVariants>,
  "variant"
> {
  media: AudioMediaType
  onDurationChange?: (duration: number) => void
  menuItems?: React.ReactNode
  className?: string
}

export const AudioMedia: React.FC<AudioMediaProps> = ({
  media,
  onDurationChange,
  menuItems,
  variant = "default",
  className,
}) => {
  const audioRef = useRef<HTMLAudioElement>(null)
  const { connect, setGain } = useAudioGain(audioRef)
  const durationRef = useRef(media.duration ?? 0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(media.duration ?? 0)
  const [started, setStarted] = useState(false)
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

  const togglePlay = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return
    if (isPlaying) {
      audio.pause()
      setIsPlaying(false)
    } else {
      setStarted(true)
      // Build the gain graph while we still have the click: audio contexts start
      // suspended and only resume from a user gesture.
      connect()
      void audio
        .play()
        .then(() => setIsPlaying(true))
        .catch(() => setIsPlaying(false))
    }
  }, [isPlaying, connect])

  const handleSeek = useCallback((seconds: number) => {
    const audio = audioRef.current
    if (!audio) return
    audio.currentTime = seconds
    setCurrentTime(seconds)
  }, [])

  const handlePlaybackRateChange = useCallback((rate: number) => {
    if (audioRef.current) audioRef.current.playbackRate = rate
  }, [])

  if (!media.url) return null

  const listenLabel = duration > 0 ? `Listen \u00b7 ${formatTime(duration)}` : "Listen"

  return (
    <div className={cn("flex items-center", className)}>
      <PlayToggle
        isPlaying={isPlaying}
        label={listenLabel}
        variant={variant ?? "default"}
        expanded={expanded}
        onToggle={togglePlay}
      />
      <div
        data-slot="audio-controls"
        inert={!expanded}
        className={audioControlsVariants({ variant, expanded })}
      >
        <Scrubber currentTime={currentTime} duration={duration} onSeek={handleSeek} />
        <SettingsMenu
          onPlaybackRateChange={handlePlaybackRateChange}
          onVolumeChange={setGain}
          menuItems={menuItems}
        />
      </div>
      <audio ref={audioRef} src={media.url} preload="metadata" />
    </div>
  )
}
