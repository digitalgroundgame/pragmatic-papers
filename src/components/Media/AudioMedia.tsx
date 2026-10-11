"use client"

import { cva, type VariantProps } from "class-variance-authority"
import { Pause, Play, Settings, Volume1, Volume2, VolumeX } from "lucide-react"
import React, { useCallback, useEffect, useId, useRef, useState } from "react"

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Separator } from "@/components/ui/separator"
import { Slider } from "@/components/ui/slider"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { cn } from "@/utilities/utils"
import { useAudioGain } from "./useAudioGain"
import type { AudioMediaType } from "./types"
import { Button } from "@/components/ui/button"

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
    <div className="text-foreground hover:text-foreground/70 flex shrink-0 items-center transition-colors">
      <Button
        variant="ghost"
        onClick={onToggle}
        size="icon-sm"
        aria-label={isPlaying ? "Pause" : "Play"}
      >
        {isPlaying ? <Pause className="size-4.5" /> : <Play className="size-4.5" />}
      </Button>
      {variant === "collapsible" && (
        <span aria-hidden className={audioLabelVariants({ variant, expanded })}>
          {label}
        </span>
      )}
    </div>
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

function VolumeIcon({ volume }: { volume: number }): React.ReactNode {
  if (volume === 0) return <VolumeX className="size-4" />
  return volume < 0.5 ? <Volume1 className="size-4" /> : <Volume2 className="size-4" />
}

function SettingsHeading({ id, children }: { id?: string; children: React.ReactNode }) {
  return (
    <p
      id={id}
      className="text-muted-foreground mb-1.5 flex items-center gap-1.5 text-xs font-medium"
    >
      {children}
    </p>
  )
}

function SpeedSetting({ value, onChange }: { value: number; onChange: (rate: number) => void }) {
  const labelId = useId()

  const handleValueChange = useCallback(
    (next: readonly string[]) => {
      // A toggle group lets its pressed button be pressed again to clear it;
      // there is always a speed, so that press changes nothing.
      if (next[0] !== undefined) onChange(Number(next[0]))
    },
    [onChange],
  )

  return (
    <div>
      <SettingsHeading id={labelId}>Speed</SettingsHeading>
      <ToggleGroup
        aria-labelledby={labelId}
        size="sm"
        spacing={1}
        value={[String(value)]}
        onValueChange={handleValueChange}
      >
        {PLAYBACK_RATES.map((rate) => (
          <ToggleGroupItem key={rate} value={String(rate)}>
            {formatRate(rate)}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
  )
}

function VolumeSetting({ value, onChange }: { value: number; onChange: (volume: number) => void }) {
  const handleValueChange = useCallback(
    (next: number | readonly number[]) => {
      const volume = singleValue(next)
      if (volume !== undefined) onChange(volume)
    },
    [onChange],
  )

  return (
    <div>
      <SettingsHeading>
        <VolumeIcon volume={value} />
        Volume
      </SettingsHeading>
      <Slider
        min={0}
        max={1}
        step={0.01}
        value={[value]}
        onValueChange={handleValueChange}
        aria-label="Volume"
        className="py-1"
      />
    </div>
  )
}

interface SettingsPanelProps {
  playbackRate: number
  onPlaybackRateChange: (rate: number) => void
  volume: number
  onVolumeChange: (volume: number) => void
  /** Extra content shown above the built-in settings, e.g. a narrator credit. */
  extraSettings?: React.ReactNode
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * A popover rather than a menu: a menu may only hold menu items, and the volume
 * slider inside one broke it for screen readers and fought it for the arrow
 * keys. A popover can hold any control, so it moves between them with
 * Tab, as a media player's settings panel usually does.
 */
function SettingsPanel({
  playbackRate,
  onPlaybackRateChange,
  volume,
  onVolumeChange,
  extraSettings,
  open,
  onOpenChange,
}: SettingsPanelProps) {
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger
        aria-label="Player settings"
        className="text-muted-foreground hover:text-foreground shrink-0 transition-colors"
        render={<Button variant="ghost" size="icon-sm" />}
      >
        <Settings className="size-4.5" />
      </PopoverTrigger>
      <PopoverContent
        align="end"
        aria-label="Player settings"
        className="flex w-auto min-w-56 flex-col gap-3"
      >
        {extraSettings && (
          <>
            {extraSettings}
            <Separator />
          </>
        )}
        <SpeedSetting value={playbackRate} onChange={onPlaybackRateChange} />
        <VolumeSetting value={volume} onChange={onVolumeChange} />
      </PopoverContent>
    </Popover>
  )
}

export interface AudioMediaProps extends Pick<
  VariantProps<typeof audioControlsVariants>,
  "variant"
> {
  media: AudioMediaType
  onDurationChange?: (duration: number) => void
  /** Extra content shown above the built-in settings, e.g. a narrator credit. */
  extraSettings?: React.ReactNode
  className?: string
}

export const AudioMedia: React.FC<AudioMediaProps> = ({
  media,
  onDurationChange,
  extraSettings,
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
  // Held here, not in the settings popover: it unmounts while closed, and
  // would reopen showing the defaults instead of what the player is using.
  const [playbackRate, setPlaybackRate] = useState(1)
  const [volume, setVolume] = useState(1)
  const [settingsOpen, setSettingsOpen] = useState(false)
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
      // Playback is over, and the collapsible player folds away: an open
      // settings panel would be left floating beside nothing.
      setSettingsOpen(false)
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
    setPlaybackRate(rate)
    if (audioRef.current) audioRef.current.playbackRate = rate
  }, [])

  const handleVolumeChange = useCallback(
    (next: number) => {
      setVolume(next)
      setGain(next)
    },
    [setGain],
  )

  if (!media.url) return null

  const listenLabel = duration > 0 ? `Listen \u00b7 ${formatTime(duration)}` : "Listen"

  return (
    <div data-slot="audio-player" className={cn("flex items-center", className)}>
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
        <SettingsPanel
          playbackRate={playbackRate}
          onPlaybackRateChange={handlePlaybackRateChange}
          volume={volume}
          onVolumeChange={handleVolumeChange}
          extraSettings={extraSettings}
          open={settingsOpen}
          onOpenChange={setSettingsOpen}
        />
      </div>
      <audio ref={audioRef} src={media.url} preload="metadata" />
    </div>
  )
}
