"use client"

import { createContext } from "react"

export interface FeedShellContextValue {
  /** Adds one pause request. Stack with `resumeAutoPlay()`. */
  pauseAutoPlay: () => void
  /** Removes one pause request. Clamped at zero. */
  resumeAutoPlay: () => void
}

function noop(): void {
  /* default placeholder until FeedShell mounts its provider */
}
const NOOP: FeedShellContextValue = {
  pauseAutoPlay: noop,
  resumeAutoPlay: noop,
}

export const FeedShellContext = createContext<FeedShellContextValue>(NOOP)
