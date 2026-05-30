"use client"

import { usePathname } from "next/navigation"
import Script from "next/script"
import { useEffect, useState } from "react"

interface RedditOEmbedClientProps {
  targetId: string
}

export function RedditEmbedClient({ targetId }: RedditOEmbedClientProps): React.ReactNode {
  const pathname = usePathname()
  const [ready, setReady] = useState(() => {
    if (typeof window === "undefined") return false
    return !!document.querySelector<HTMLScriptElement>(
      'script[src="https://embed.reddit.com/widgets.js"]',
    )
  })

  useEffect(() => {
    if (!ready) return
    const node = document.getElementById(targetId) as HTMLElement | null
    if (!node) return

    // Reddit has no public "scan/load" API. Re-inserting the script inside
    // the target node reliably retriggers blockquote processing.
    const id = requestAnimationFrame(() => {
      const script = document.createElement("script")
      script.src = "https://embed.reddit.com/widgets.js"
      script.async = true
      script.charset = "UTF-8"
      node.appendChild(script)
    })

    return () => {
      cancelAnimationFrame(id)
      const appended = node.querySelectorAll<HTMLScriptElement>(
        'script[src="https://embed.reddit.com/widgets.js"]',
      )
      for (const script of appended) script.remove()
    }
  }, [ready, targetId, pathname])

  return (
    <Script
      id="reddit-embed-widgets"
      src="https://embed.reddit.com/widgets.js"
      strategy="afterInteractive"
      onReady={() => setReady(true)}
    />
  )
}
