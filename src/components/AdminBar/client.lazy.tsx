"use client"

import dynamic from "next/dynamic"
import React, { useEffect, useState } from "react"

import { getClientSideURL } from "@/utilities/getURL"

// Payload's admin bar loads only for someone logged in: no reader ever sees it.
const AdminBarClient = dynamic(() => import("./client").then((m) => m.AdminBarClient))

/**
 * `AdminBarClient`, once Payload says someone is logged in. Their session cookie is httpOnly,
 * so asking Payload, as the bar itself does, is the only way to tell.
 */
export function LazyAdminBar({ preview }: { preview?: boolean }): React.ReactNode {
  const [loggedIn, setLoggedIn] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    fetch(`${getClientSideURL()}/api/users/me`, {
      credentials: "include",
      signal: controller.signal,
    })
      .then((response) => (response.ok ? response.json() : undefined))
      .then((body: { user?: unknown } | undefined) => {
        if (body?.user) setLoggedIn(true)
      })
      .catch(() => undefined)
    return () => controller.abort()
  }, [])

  return loggedIn ? <AdminBarClient preview={preview} /> : null
}
