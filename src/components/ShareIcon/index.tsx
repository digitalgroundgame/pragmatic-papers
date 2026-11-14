"use client"

import { type LucideProps, Share2Icon, ShareIcon as AppleShareIcon } from "lucide-react"
import React, { useSyncExternalStore } from "react"

/** Whether the reader is on a Mac, iPhone or iPad (which reports itself as a Mac). */
export function isApplePlatform(nav: Navigator | undefined = globalThis.navigator): boolean {
  if (!nav) return false
  const hinted = (nav as Navigator & { userAgentData?: { platform?: string } }).userAgentData
    ?.platform
  if (hinted) return hinted === "macOS" || hinted === "iOS"
  return /Mac|iPhone|iPad|iPod/.test(nav.platform || nav.userAgent)
}

const noSubscription = () => () => undefined

/**
 * The share icon each reader knows: Apple's box and arrow on Apple devices, the three joined dots
 * everywhere else. Pages are cached for everyone, so the server draws the dots and an Apple
 * device swaps them once it hydrates.
 */
export const ShareIcon: React.FC<LucideProps> = (props) => {
  const apple = useSyncExternalStore(noSubscription, isApplePlatform, () => false)
  const Icon = apple ? AppleShareIcon : Share2Icon
  return <Icon {...props} />
}
