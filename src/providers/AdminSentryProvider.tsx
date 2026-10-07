"use client"

import { useAuth } from "@payloadcms/ui"
import { useEffect } from "react"

import { setUser } from "@/sentryClient"

/**
 * The admin panel's Sentry provider, in place of @payloadcms/plugin-sentry's
 * `AdminErrorBoundary` (see src/sentryPayload.ts). Attaches the signed-in user to what the
 * browser reports from the admin, as the plugin's `afterError` hook does on the server, so an
 * editor's crash and the request that failed under it name the same person. What gets
 * reported is set up before the page loads: instrumentation-client.ts.
 */
export const AdminSentryProvider: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth()
  const id = user?.id
  const email = user?.email
  const collection = user?.collection

  useEffect(() => {
    setUser(id === undefined ? null : { id: String(id), email: email ?? undefined, collection })
  }, [id, email, collection])

  return children
}
