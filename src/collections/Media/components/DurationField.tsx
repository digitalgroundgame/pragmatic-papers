"use client"

import { FieldLabel, useField, useFormFields } from "@payloadcms/ui"
import type { NumberFieldClientProps } from "payload"
import React, { useEffect, useRef } from "react"

export const DurationField: React.FC<NumberFieldClientProps> = ({ field, path }) => {
  const { value, setValue } = useField<number>({ path: path ?? field.name })
  const url = useFormFields(([fields]) => fields.url?.value as string | undefined)
  const hasMountedRef = useRef(false)
  // Capture the value present at mount — used to skip recalculation when
  // opening an existing record that already has a stored duration.
  const initialValueRef = useRef(value)

  useEffect(() => {
    if (!url) return

    if (!hasMountedRef.current) {
      hasMountedRef.current = true
      // Skip on initial load if a duration was already stored
      if (initialValueRef.current) return
    }

    let seeking = false
    const audio = new Audio(url)

    const onLoadedMetadata = () => {
      if (isFinite(audio.duration)) {
        setValue(audio.duration)
      } else {
        // Files without a duration header report Infinity. Seeking past the end
        // forces the browser to find the real end and re-fire durationchange.
        seeking = true
        audio.currentTime = 1e9
      }
    }

    const onDurationChange = () => {
      if (!isFinite(audio.duration)) return
      setValue(audio.duration)
      if (seeking) {
        seeking = false
        audio.currentTime = 0
      }
    }

    audio.addEventListener("loadedmetadata", onLoadedMetadata)
    audio.addEventListener("durationchange", onDurationChange)
    audio.load()

    return () => {
      audio.removeEventListener("loadedmetadata", onLoadedMetadata)
      audio.removeEventListener("durationchange", onDurationChange)
    }
  }, [url, setValue])

  const formatted = value
    ? `${Math.floor(value / 60)}:${Math.floor(value % 60)
        .toString()
        .padStart(2, "0")}`
    : url
      ? "Calculating…"
      : "—"

  return (
    <div>
      <FieldLabel label={field.label as string} />
      <p style={{ margin: 0, fontSize: "0.875rem" }}>{formatted}</p>
    </div>
  )
}
