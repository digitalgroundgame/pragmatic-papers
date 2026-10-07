"use client"

import dynamic from "next/dynamic"
import React, { useEffect, useState, useSyncExternalStore } from "react"

import { getClientSideURL } from "@/utilities/getURL"

import { readAdminBarHint, writeAdminBarHint } from "./hint"

// Payload's admin bar loads only for someone logged in: no reader ever sees it.
const AdminBarClient = dynamic(() => import("./client").then((m) => m.AdminBarClient))

// The hint only changes when this component writes it, alongside state that re-renders anyway.
const subscribeToNothing = () => () => undefined

/**
 * `AdminBarClient`, once Payload says someone is logged in. Their session cookie is httpOnly,
 * so asking Payload, as the bar itself does, is the only way to tell.
 *
 * The slot it sits in is hidden until `<html>` carries `data-admin-bar` (the class names it
 * literally, for Tailwind), which the hint script in the layout's `<head>` sets before the first
 * paint when the last page saw someone logged in. So the bar loads into room already made for it,
 * and readers get no gap. Whatever Payload answers corrects the hint for the next page.
 */
export function LazyAdminBar({ preview }: { preview?: boolean }): React.ReactNode {
  // Payload's answer, once there is one.
  const [loggedIn, setLoggedIn] = useState<boolean>()
  // Until then, the hint loads the bar straight away: it's very likely needed. Read after
  // hydration, as the prerendered page knows nothing of it.
  const hinted = useSyncExternalStore(subscribeToNothing, readAdminBarHint, () => false)

  useEffect(() => {
    const controller = new AbortController()
    fetch(`${getClientSideURL()}/api/users/me`, {
      credentials: "include",
      signal: controller.signal,
    })
      .then((response) => (response.ok ? response.json() : undefined))
      .then((body: { user?: unknown } | undefined) => {
        // No answer says nothing about who is logged in, so leaves things as they are.
        if (!body) return
        const user = Boolean(body.user)
        writeAdminBarHint(user)
        setLoggedIn(user)
      })
      .catch(() => undefined)
    return () => controller.abort()
  }, [])

  return (
    <div className="hidden h-8 bg-black [html[data-admin-bar]_&]:block">
      {(loggedIn ?? hinted) ? <AdminBarClient preview={preview} /> : null}
    </div>
  )
}
