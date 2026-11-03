"use client"

import { createContext, useContext } from "react"

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

/** Provided by the reading feed's shell (`src/app/feed/FeedShell.tsx`). */
export const FeedShellContext = createContext<FeedShellContextValue>(NOOP)

/** Lets a feed block renderer pause / resume the feed's auto-play timer
 *  (e.g. while a dialog is open). Pause requests stack — each `pauseAutoPlay`
 *  must be balanced by a `resumeAutoPlay` for the feed to resume. */
export function useFeedAutoPlay(): FeedShellContextValue {
  return useContext(FeedShellContext)
}
