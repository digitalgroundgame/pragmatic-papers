"use client"

import React from "react"

import { Logo, type LogoProps } from "@/components/Logo"

const AnimatedLogo = React.lazy(() =>
  import("./AnimatedLogo").then((m) => ({ default: m.AnimatedLogo })),
)

// Nothing to subscribe to: the answer changes once, at hydration, which React handles.
const subscribe = () => () => undefined

/**
 * `AnimatedLogo`, loaded once the page has hydrated: lottie and the two animations are ~60 kB
 * of gzipped JavaScript the header would otherwise put on every page's first load. Until then,
 * and on the server, it is the static `Logo` the animated one starts from, so nothing moves.
 */
export function LazyAnimatedLogo(props: Pick<LogoProps, "className" | "size">): React.ReactElement {
  const hydrated = React.useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  )
  const still = <Logo {...props} />
  if (!hydrated) return still
  return (
    <React.Suspense fallback={still}>
      <AnimatedLogo {...props} />
    </React.Suspense>
  )
}
