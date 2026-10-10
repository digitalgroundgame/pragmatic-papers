"use client"

import { usePathname, useRouter, useSearchParams } from "next/navigation"
import type React from "react"
import { useEffect, useMemo, useRef, useSyncExternalStore } from "react"

import { findTour, TOUR_PARAM, TOURS } from "./registry"
import { matchesPath, parseProgress, placeStep, PROGRESS_KEY, type TourProgress } from "./steps"

/** How long a step waits for what it points at, e.g. a list still loading. */
const WAIT_MS = 10_000

const waitForElement = (selector: string, timeout: number): Promise<Element | null> =>
  new Promise((resolve) => {
    const started = Date.now()
    const look = (): void => {
      const element = document.querySelector(selector)
      if (element || Date.now() - started > timeout) resolve(element)
      else window.setTimeout(look, 100)
    }
    look()
  })

// The tour's place, in sessionStorage so it survives the page changes a tour makes. Kept as the
// stored string, so React sees the same snapshot until it changes; `memory` stands in when
// storage is blocked, and the tour then just won't survive a full reload.
let memory: string | null = null
const listeners = new Set<() => void>()

const readStored = (): string | null => {
  try {
    return window.sessionStorage.getItem(PROGRESS_KEY)
  } catch {
    return memory
  }
}

const writeProgress = (progress: TourProgress | null): void => {
  memory = progress ? JSON.stringify(progress) : null
  try {
    if (memory) window.sessionStorage.setItem(PROGRESS_KEY, memory)
    else window.sessionStorage.removeItem(PROGRESS_KEY)
  } catch {
    // Blocked: `memory` has it.
  }
  listeners.forEach((listener) => listener())
}

const subscribe = (listener: () => void): (() => void) => {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/**
 * Wraps the admin panel and runs guided tours (`src/plugins/tours/`). A link with
 * `?tour=<key>` starts one (see `tourHref`); the step it's on is kept in sessionStorage, so the
 * tour carries on as it opens other admin pages. driver.js loads only when a step is shown.
 * A step whose element never appears ends the tour quietly rather than pointing at nothing.
 */
export function TourProvider({ children }: { children: React.ReactNode }): React.ReactNode {
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const stored = useSyncExternalStore(subscribe, readStored, () => null)
  const progress = useMemo(() => parseProgress(stored, TOURS), [stored])
  // The step whose page was last opened, so a page that sends the reader elsewhere (the login
  // page, say) ends the tour instead of opening it again and again.
  const opened = useRef<string | null>(null)
  // The step last shown. If the reader leaves its page themselves, by clicking what it points
  // at, the tour moves on when the new page is the next step's, and ends otherwise.
  const shown = useRef<string | null>(null)

  // Start a tour from its link.
  const query = searchParams.toString()
  const requested = searchParams.get(TOUR_PARAM)
  useEffect(() => {
    if (!requested) return
    const params = new URLSearchParams(query)
    params.delete(TOUR_PARAM)
    // Drop the parameter, so reloading the page doesn't start the tour again.
    router.replace(params.size ? `${pathname}?${params}` : pathname)
    const tour = findTour(requested)
    if (tour) writeProgress({ key: tour.key, step: 0 })
  }, [requested, query, pathname, router])

  useEffect(() => {
    if (!progress || requested) return
    const tour = findTour(progress.key)
    const step = tour?.steps[progress.step]
    if (!tour || !step) return writeProgress(null)

    const place = placeStep(step, pathname)
    const id = `${tour.key}:${progress.step}`
    if (place.action !== "show" && shown.current === id) {
      shown.current = null
      const next = tour.steps[progress.step + 1]
      return writeProgress(
        next && matchesPath(next.path, pathname)
          ? { key: tour.key, step: progress.step + 1 }
          : null,
      )
    }
    if (place.action === "end" || (place.action === "open" && opened.current === id)) {
      return writeProgress(null)
    }
    if (place.action === "open") {
      opened.current = id
      router.push(place.path)
      return
    }

    let cancelled = false
    let remove: (() => void) | undefined
    void (async () => {
      const element = step.element ? await waitForElement(step.element, WAIT_MS) : undefined
      if (cancelled) return
      if (step.element && !element) {
        console.warn(`Tour "${tour.key}" ended: step ${progress.step + 1} found no ${step.element}`)
        writeProgress(null)
        return
      }
      const { showStep } = await import("./showStep")
      if (cancelled) return
      shown.current = id
      remove = showStep({
        tour,
        index: progress.step,
        element: element ?? undefined,
        onNext: () => {
          const next = progress.step + 1
          if (next >= tour.steps.length) return writeProgress(null)
          const link = step.follow ? (element?.closest("a") ?? element?.querySelector("a")) : null
          const href = link?.getAttribute("href")
          // Following a link moves on when its page loads, as a click on it would.
          if (href) router.push(href)
          else writeProgress({ key: tour.key, step: next })
        },
        onPrevious: () => writeProgress({ key: tour.key, step: Math.max(0, progress.step - 1) }),
        onClose: () => writeProgress(null),
      })
    })()

    return () => {
      cancelled = true
      remove?.()
    }
  }, [progress, requested, pathname, router])

  return children
}
