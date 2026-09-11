"use client"

import { useTheme } from "@wrksz/themes/client"
import { LottieLight, type LottieHandle } from "lottie-react"
import React from "react"

import { Logo, logoVariants, type LogoProps } from "@/components/Logo"
import { cn } from "@/utilities/utils"

import wordmarkInverted from "./wordmark-inverted.json"
import wordmark from "./wordmark.json"

/**
 * Frames from the start of the animation to a point inside the hold, where every letter is
 * drawn and the wipe has not begun. The whole thing is 110 frames at 60fps: on by ~40, wiping
 * from ~70.
 */
const DRAW_ON = [0, 60] as const

/**
 * How often the wordmark draws itself again.
 *
 * Long enough that it is a thing the page does now and then rather than a thing the page is
 * doing: a logo that loops is a status indicator, and the reader is not waiting for anything.
 */
const REPEAT_MS = 2 * 60 * 1000

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)"

function subscribeToMotion(onChange: () => void): () => void {
  const query = window.matchMedia(REDUCED_MOTION)
  query.addEventListener("change", onChange)
  return () => query.removeEventListener("change", onChange)
}

const motionIsReduced = (): boolean => window.matchMedia(REDUCED_MOTION).matches

/**
 * The wordmark drawn rather than set: the same letters as `Logo`, animating.
 *
 * It shares `logoVariants`, so it stands exactly where the static one does at every size. The
 * animation is 800×96 and the logo's viewBox is 100×12 — the same shape — which is what lets
 * the two be swapped without the header moving under the reader.
 *
 * Two files, because the letters carry their own fill rather than inheriting a colour: the
 * full-colour one on the page's own ground, and an inverted one where that ground is dark and
 * black letters would not be there at all — the paper icon keeps its brand orange in both.
 * */
export function AnimatedLogo({
  className,
  size,
}: Pick<LogoProps, "className" | "size">): React.ReactElement {
  const still = React.useSyncExternalStore(subscribeToMotion, motionIsReduced, () => true)
  const { resolvedTheme } = useTheme()
  const lottie = React.useRef<LottieHandle>(null)

  React.useEffect(() => {
    if (still) return
    const timer = setInterval(() => lottie.current?.playSegments(DRAW_ON), REPEAT_MS)
    return () => clearInterval(timer)
  }, [still])

  if (still || !resolvedTheme) return <Logo size={size} className={className} />

  return (
    <>
      <span className={cn(logoVariants({ size, className }), "block aspect-25/3")}>
        <LottieLight
          src={resolvedTheme === "dark" ? wordmarkInverted : wordmark}
          lottieRef={lottie}
          autoplay
          loop={false}
          segment={DRAW_ON}
          className="size-full"
          aria-hidden="true"
        />
      </span>
      <span className="sr-only">The Pragmatic Papers Logo</span>
    </>
  )
}
