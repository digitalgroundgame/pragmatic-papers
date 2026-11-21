"use client"

import { useAuth, useConfig } from "@payloadcms/ui"
import { getSafeRedirect } from "payload/shared"
import { useEffect } from "react"

/**
 * Sends someone who is already signed in on from the login page. A page opened from another
 * site (a link in Slack, email or GitHub) is a cross-site request, and with a `csrf` list
 * Payload takes no login cookie from one, so the admin renders the login page for them. The
 * admin's own request for the current user comes from this page, which is the site itself, so
 * it finds them: once it has, go where they were headed.
 */
export function ResumeSession(): null {
  const { user } = useAuth()
  const { config } = useConfig()
  const adminRoute = config.routes.admin

  useEffect(() => {
    if (!user) return
    const redirectTo = new URLSearchParams(window.location.search).get("redirect")
    window.location.replace(
      getSafeRedirect({ fallbackTo: adminRoute, redirectTo: redirectTo ?? "" }),
    )
  }, [user, adminRoute])

  return null
}
