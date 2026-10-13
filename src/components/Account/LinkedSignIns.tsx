"use client"

import { useSearchParams } from "next/navigation"
import React, { useEffect, useState } from "react"

import { Button } from "@/components/ui/button"
import type { LinkedProvider } from "@/plugins/sso/types"

/** What the provider's callback puts in `?error=` when a link doesn't take. */
const LINK_ERRORS: Record<string, string> = {
  account_already_linked_to_different_user:
    "That account is already linked to someone else here. They need to disconnect it first.",
  unable_to_link_account: "That provider wouldn't let the account be linked.",
}
const LINK_FAILED = "That didn't work. Try again."

/**
 * The accounts the signed-in member signs in with, each with Connect or Disconnect. Their last
 * one can't be disconnected: a member has no password to fall back on.
 */
export const LinkedSignIns: React.FC<{ apiPath: string }> = ({ apiPath }) => {
  const params = useSearchParams()
  const base = `${apiPath}/auth-links`
  const [providers, setProviders] = useState<LinkedProvider[] | null>(null)
  const [pending, setPending] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(() => {
    const code = params.get("error")
    return code ? (LINK_ERRORS[code] ?? LINK_FAILED) : null
  })

  // Bumped after a disconnect, to read the list again.
  const [version, setVersion] = useState(0)

  useEffect(() => {
    let cancelled = false
    void fetch(base, { credentials: "same-origin" })
      .then(async (response) =>
        response.ok ? ((await response.json()) as { providers: LinkedProvider[] }).providers : [],
      )
      .catch(() => [])
      .then((list) => {
        if (!cancelled) setProviders(list)
      })
    return () => {
      cancelled = true
    }
  }, [base, version])

  if (!providers || providers.length === 0) return null
  const linkedCount = providers.filter(({ linked }) => linked).length

  const connect = async (provider: string) => {
    setPending(provider)
    setError(null)
    try {
      const response = await fetch(`${base}/${provider}`, {
        method: "POST",
        credentials: "same-origin",
      })
      const { url } = (await response.json()) as { url?: string }
      if (!response.ok || !url) throw new Error("no redirect")
      window.location.assign(url)
    } catch {
      setError(LINK_FAILED)
      setPending(null)
    }
  }

  const disconnect = async (provider: string) => {
    setPending(provider)
    setError(null)
    try {
      const response = await fetch(`${base}/${provider}`, {
        method: "DELETE",
        credentials: "same-origin",
      })
      if (!response.ok) {
        const { message } = (await response.json().catch(() => ({}))) as { message?: string }
        setError(message ?? LINK_FAILED)
      }
      setVersion((n) => n + 1)
    } catch {
      setError(LINK_FAILED)
    } finally {
      setPending(null)
    }
  }

  return (
    <section className="space-y-3" aria-labelledby="sign-ins-heading">
      <h2 id="sign-ins-heading" className="text-lg font-semibold">
        Sign-ins
      </h2>
      <p className="text-muted-foreground text-sm">Sign in with any account connected here.</p>
      {error ? (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      ) : null}
      <ul className="divide-border divide-y rounded-sm border">
        {providers.map(({ id, label, linked }) => (
          <li key={id} className="flex items-center justify-between gap-3 p-3">
            <span>
              <span className="font-medium">{label}</span>{" "}
              <span className="text-muted-foreground text-sm">
                {linked ? "Connected" : "Not connected"}
              </span>
            </span>
            {linked ? (
              <Button
                variant="outline"
                size="sm"
                disabled={pending !== null || linkedCount <= 1}
                title={linkedCount <= 1 ? "Connect another account first" : undefined}
                aria-label={`Disconnect ${label}`}
                onClick={() => void disconnect(id)}
              >
                Disconnect
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                disabled={pending !== null}
                aria-label={`Connect ${label}`}
                onClick={() => void connect(id)}
              >
                Connect
              </Button>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}
