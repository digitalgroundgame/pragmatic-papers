"use client"

import type { Media } from "@/payload-types"
import { Pause, Play } from "lucide-react"
import React, { useCallback, useEffect, useRef, useState } from "react"

import { Slider } from "@/components/ui/slider"

function formatTime(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return "0:00"
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, "0")}`
}

export interface AudioMediaProps {
  media: Media & { mimeType: `audio/${string}` }
  captionSrc?: string
  onDurationChange?: (duration: number) => void
}

export const AudioMedia: React.FC<AudioMediaProps> = ({ media, onDurationChange }) => {
  const audioRef = useRef<HTMLAudioElement>(null)
  const durationRef = useRef(media.duration ?? 0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(media.duration ?? 0)

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
      void audio
        .play()
        .then(() => setIsPlaying(true))
        .catch(() => setIsPlaying(false))
    }
  }, [isPlaying])

  const handleSeek = useCallback((value: number | readonly number[]) => {
    const audio = audioRef.current
    const newTime = Array.isArray(value) ? value[0] : value
    if (!audio || newTime === undefined) return
    audio.currentTime = newTime
    setCurrentTime(newTime)
  }, [])

  if (!media.url) return null

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={togglePlay}
        aria-label={isPlaying ? "Pause" : "Play"}
        className="text-primary hover:text-primary/70 shrink-0 transition-colors"
      >
        {isPlaying ? <Pause className="size-5" /> : <Play className="size-5" />}
      </button>
      <Slider
        min={0}
        max={duration || 100}
        value={[currentTime]}
        onValueChange={handleSeek}
        aria-label="Seek"
      />
      <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
        {`${formatTime(currentTime)} / ${formatTime(duration)}`}
      </span>
      {/* eslint-disable-next-line jsx-a11y/media-has-caption -- TODO: fix this. */}
      <audio ref={audioRef} src={media.url} preload="metadata">
        {/* <track kind="captions" src={captionSrc || undefined} default={!!captionSrc} /> */}
      </audio>
    </div>
  )
}
