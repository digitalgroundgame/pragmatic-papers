"use client"

import { usePathname } from "next/navigation"
import Script from "next/script"
import { useEffect, useState } from "react"

declare global {
  interface Window {
    bluesky?: {
      scan?: (node?: ParentNode) => void
    }
  }
}
interface BlueskyEmbedClientProps {
  targetId: string
}

export function BlueskyEmbedClient({ targetId }: BlueskyEmbedClientProps): React.ReactNode {
  const pathname = usePathname()
  const [ready, setReady] = useState(() => typeof window !== "undefined" && !!window.bluesky?.scan)

  // Transform to iframe when ready, when markup changes, and on navigation.
  useEffect(() => {
    if (!ready) return
    const node = document.getElementById(targetId) as HTMLElement | null
    if (!node) return

    const id = requestAnimationFrame(() => {
      window.bluesky?.scan?.(node)
    })

    return () => cancelAnimationFrame(id)
  }, [ready, targetId, pathname])

  return (
    <Script
      id="bluesky-script"
      src="https://embed.bsky.app/static/embed.js"
      strategy="afterInteractive"
      onReady={() => setReady(true)}
    />
  )
}
