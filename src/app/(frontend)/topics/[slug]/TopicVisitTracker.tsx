"use client"

import { useNotification } from "@/providers/NotificationProvider"
import { useEffect } from "react"

export function TopicVisitTracker({ slug }: { slug: string }): null {
  const { setLastVisited } = useNotification(`topic:${slug}`)

  useEffect(() => {
    setLastVisited()
  }, [setLastVisited])

  return null
}
