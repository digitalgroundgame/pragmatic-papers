"use client"

import { useContext } from "react"
import { FeedShellContext, type FeedShellContextValue } from "../FeedShellContext"

/** Lets a FeedComponent pause / resume the feed's auto-play timer
 *  (e.g. while a dialog is open). Pause requests stack — each `pauseAutoPlay`
 *  must be balanced by a `resumeAutoPlay` for the feed to resume. */
export function useFeedAutoPlay(): FeedShellContextValue {
  return useContext(FeedShellContext)
}
