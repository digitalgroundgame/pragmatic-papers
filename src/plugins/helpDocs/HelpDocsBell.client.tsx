"use client"

import type { HelpDoc } from "@/docs"
import { usePreferences } from "@payloadcms/ui"
import type React from "react"
import { useCallback, useState } from "react"

import { HelpDocsMenu } from "./HelpDocsMenu"
import { HELP_DOCS_PREFERENCE, type HelpDocsPreference } from "./unread"

interface HelpDocsBellClientProps {
  docs: HelpDoc[]
  initialUnread: string[]
  read: string[]
}

/** Keeps the menu's unread state, and saves what's been read to the user's preferences. */
export function HelpDocsBellClient({
  docs,
  initialUnread,
  read: initialRead,
}: HelpDocsBellClientProps): React.ReactNode {
  const { setPreference } = usePreferences()
  const [read, setRead] = useState(initialRead)
  const [unread, setUnread] = useState(initialUnread)

  const markRead = useCallback(
    (slugs: string[]) => {
      const next = [...new Set([...read, ...slugs])]
      if (next.length === read.length) return
      setRead(next)
      setUnread((current) => current.filter((slug) => !slugs.includes(slug)))
      void setPreference<HelpDocsPreference>(HELP_DOCS_PREFERENCE, { read: next })
    },
    [read, setPreference],
  )

  return (
    <HelpDocsMenu
      docs={docs}
      unread={unread}
      onOpenDoc={(slug) => markRead([slug])}
      onMarkAllRead={() => markRead(unread)}
    />
  )
}
