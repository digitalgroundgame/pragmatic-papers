"use client"

import { usePathname } from "next/navigation"
import Script from "next/script"
import { useEffect, useState } from "react"

declare global {
  interface Window {
    twttr?: {
      widgets?: {
        load?: (node?: HTMLElement) => void
      }
    }
  }
}

interface TwitterEmbedClientProps {
  targetId: string
}

export function TwitterEmbedClient({ targetId }: TwitterEmbedClientProps): React.ReactNode {
  const pathname = usePathname()
  const [ready, setReady] = useState(
    () => typeof window !== "undefined" && !!window.twttr?.widgets?.load,
  )

  // Transform to iframe when ready, when markup changes, and on navigation.
  useEffect(() => {
    if (!ready) return
    const node = document.getElementById(targetId) as HTMLElement | null
    if (!node) return
    const id = requestAnimationFrame(() => {
      window.twttr?.widgets?.load?.(node)
    })

    return () => cancelAnimationFrame(id)
  }, [ready, targetId, pathname])

  return (
    <Script
      id="twitter-widgets"
      src="https://platform.twitter.com/widgets.js"
      strategy="afterInteractive"
      onReady={() => setReady(true)}
    />
  )
}
