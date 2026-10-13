"use client"

import { useAuth, useConfig, useDocumentInfo } from "@payloadcms/ui"
import { useSearchParams } from "next/navigation"
import React, { useEffect, useState } from "react"

import { LINKS_ENDPOINT_PATH } from "../constants"
import type { LinkedProvider } from "../types"
import { LinkedAccountsPanel } from "./LinkedAccountsPanel"

/**
 * The Connections panel, on the signed-in user's own account page only. While single
 * sign-on is off or no provider is configured (the list answers 404), it says so.
 */
export const LinkedAccounts: React.FC = () => {
  const { user } = useAuth()
  const { id } = useDocumentInfo()
  const {
    config: { routes },
  } = useConfig()
  const callbackError = useSearchParams().get("error")
  const [providers, setProviders] = useState<LinkedProvider[] | null>(null)
  const [pending, setPending] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)

  const isOwnAccount = user != null && id != null && String(user.id) === String(id)
  const base = `${routes.api}${LINKS_ENDPOINT_PATH}`

  // Bumped after a disconnect, to read the list again.
  const [version, setVersion] = useState(0)

  useEffect(() => {
    if (!isOwnAccount) return
    let cancelled = false
    void fetch(base, { credentials: "include" })
      .then(async (response) =>
        response.ok ? ((await response.json()) as { providers: LinkedProvider[] }).providers : null,
      )
      .catch(() => null)
      .then((list) => {
        if (!cancelled) setProviders(list ?? [])
      })
    return () => {
      cancelled = true
    }
  }, [isOwnAccount, base, version])

  if (!isOwnAccount || !providers) return null

  const connect = async (provider: LinkedProvider["id"]) => {
    setPending(provider)
    setFailed(false)
    try {
      const response = await fetch(`${base}/${provider}`, {
        method: "POST",
        credentials: "include",
      })
      const { url } = (await response.json()) as { url?: string }
      if (!response.ok || !url) throw new Error("no redirect")
      window.location.assign(url)
    } catch {
      setPending(null)
      setFailed(true)
    }
  }

  const disconnect = async (provider: LinkedProvider["id"]) => {
    setPending(provider)
    setFailed(false)
    try {
      const response = await fetch(`${base}/${provider}`, {
        method: "DELETE",
        credentials: "include",
      })
      if (!response.ok) throw new Error("not disconnected")
      setVersion((v) => v + 1)
    } catch {
      setFailed(true)
    } finally {
      setPending(null)
    }
  }

  return (
    <LinkedAccountsPanel
      providers={providers}
      pending={pending}
      error={failed ? "request_failed" : callbackError}
      onConnect={(provider) => void connect(provider)}
      onDisconnect={(provider) => void disconnect(provider)}
    />
  )
}
