"use client"

import { useCallback, useEffect, useRef } from "react"

/**
 * Smooths volume changes for an `<audio>` element.
 *
 * Writing `audio.volume` applies the new gain to whichever buffer is playing
 * next, so dragging a volume slider lands one step discontinuity per animation
 * frame — measured at ~9% per frame on a quick drag — and those steps are
 * audible as crackle. A Web Audio `GainNode` interpolates between values on the
 * audio thread instead, which is the only way to change gain without a step.
 *
 * `createMediaElementSource` reroutes the element permanently and returns
 * silence for cross-origin media without CORS headers, so the graph is only
 * built for same-origin sources (locally stored media). Everything else falls
 * back to `audio.volume`, rate-limited so a fast drag glides instead of
 * jumping — smaller steps, quieter artifacts.
 */

/** Seconds for the audio thread to approach a new gain. Short enough to feel instant. */
const RAMP_TIME_CONSTANT = 0.02

/** Largest `audio.volume` change per frame on the fallback path. */
const MAX_STEP_PER_FRAME = 0.03

function isSameOrigin(src: string): boolean {
  if (!src) return false
  try {
    return new URL(src, window.location.href).origin === window.location.origin
  } catch {
    return false
  }
}

interface AudioGain {
  /** Build the graph, if it can be built. Call from a user gesture — audio contexts start suspended. */
  connect: () => void
  /** Move the output gain to `value` (0–1) without stepping. */
  setGain: (value: number) => void
}

export function useAudioGain(audioRef: React.RefObject<HTMLAudioElement | null>): AudioGain {
  const contextRef = useRef<AudioContext | null>(null)
  const gainRef = useRef<GainNode | null>(null)
  const targetRef = useRef(1)
  const frameRef = useRef<number | null>(null)
  // Once the graph exists the element is routed through it, so a failed attempt
  // must not be retried on every play.
  const attemptedRef = useRef(false)

  const startGlide = useCallback(() => {
    if (frameRef.current !== null) return

    const step = (): void => {
      const audio = audioRef.current
      if (!audio) {
        frameRef.current = null
        return
      }

      const delta = targetRef.current - audio.volume
      if (Math.abs(delta) <= MAX_STEP_PER_FRAME) {
        audio.volume = targetRef.current
        frameRef.current = null
        return
      }

      audio.volume = Math.min(1, Math.max(0, audio.volume + Math.sign(delta) * MAX_STEP_PER_FRAME))
      frameRef.current = requestAnimationFrame(step)
    }

    frameRef.current = requestAnimationFrame(step)
  }, [audioRef])

  const connect = useCallback(() => {
    const audio = audioRef.current
    if (!audio || attemptedRef.current) {
      void contextRef.current?.resume()
      return
    }
    attemptedRef.current = true

    if (!isSameOrigin(audio.currentSrc || audio.src)) return

    try {
      const context = new AudioContext()
      const gain = context.createGain()
      gain.gain.value = targetRef.current
      context.createMediaElementSource(audio).connect(gain).connect(context.destination)
      // The element's own volume multiplies the graph's output; leave it open so
      // the gain node is the only thing setting the level.
      audio.volume = 1
      contextRef.current = context
      gainRef.current = gain
      void context.resume()
    } catch {
      // No Web Audio (or the element is already routed elsewhere) — the fallback
      // path keeps working.
    }
  }, [audioRef])

  const setGain = useCallback(
    (value: number) => {
      const clamped = Math.min(1, Math.max(0, value))
      targetRef.current = clamped

      const context = contextRef.current
      const gain = gainRef.current
      if (context && gain) {
        gain.gain.setTargetAtTime(clamped, context.currentTime, RAMP_TIME_CONSTANT)
        return
      }

      startGlide()
    },
    [startGlide],
  )

  useEffect(() => {
    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current)
      void contextRef.current?.close()
    }
  }, [])

  return { connect, setGain }
}
