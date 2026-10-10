"use client"

import { usePreferences } from "@payloadcms/ui"
import type React from "react"
import { useCallback, useMemo, useState } from "react"

import { NotificationsMenu, type NotificationIndex } from "./NotificationsMenu"
import type { NotificationItem, NotificationsPreference, NotificationType } from "./types"
import { PREFERENCE_KEY, unreadNotifications, visibleNotifications } from "./unread"

interface NotificationsBellClientProps {
  indexes: NotificationIndex[]
  items: NotificationItem[]
  joinedAt?: string
  preference: NotificationsPreference
  types: NotificationType[]
}

/** Keeps what's read and muted, and saves both to the user's preferences. */
export function NotificationsBellClient({
  indexes,
  items,
  joinedAt,
  preference: initial,
  types,
}: NotificationsBellClientProps): React.ReactNode {
  const { setPreference } = usePreferences()
  const [preference, setLocal] = useState(initial)

  const save = useCallback(
    (next: NotificationsPreference) => {
      setLocal(next)
      void setPreference<NotificationsPreference>(PREFERENCE_KEY, next)
    },
    [setPreference],
  )

  const visible = useMemo(
    () => visibleNotifications(items, preference.muted),
    [items, preference.muted],
  )
  const unread = useMemo(
    () => unreadNotifications(visible, preference.read, joinedAt),
    [visible, preference.read, joinedAt],
  )

  const markRead = (keys: string[]): void => {
    const read = [...new Set([...preference.read, ...keys])]
    if (read.length !== preference.read.length) save({ ...preference, read })
  }

  return (
    <NotificationsMenu
      indexes={indexes.filter((index) => !preference.muted.includes(index.type))}
      items={visible}
      muted={preference.muted}
      types={types}
      unread={unread}
      onOpen={(key) => markRead([key])}
      onMarkAllRead={() => markRead(unread)}
      onMutedChange={(muted) => save({ ...preference, muted })}
    />
  )
}
