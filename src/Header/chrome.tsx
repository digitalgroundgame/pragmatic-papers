"use client"

import { usePathname } from "next/navigation"
import React from "react"

import { AnimatedLogo } from "@/components/Logo/AnimatedLogo"
import { Logo } from "@/components/Logo"

/** The one place the rule lives: which routes get the wordmark drawn rather than set. */
export function drawsLogo(pathname: string | null): boolean {
  return pathname?.startsWith("/interactives") ?? false
}

/**
 * The wordmark for wherever the reader is: drawn on the interactives, set everywhere else.
 *
 * The animation only reaches a reader who lands on one — it is imported by this component and
 * this component is what decides whether to mount it.
 */
export function HeaderLogo({ className }: { className?: string }): React.ReactElement {
  return drawsLogo(usePathname()) ? (
    <AnimatedLogo className={className} />
  ) : (
    <Logo className={className} />
  )
}
