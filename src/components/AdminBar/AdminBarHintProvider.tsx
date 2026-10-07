"use client"

import { useAuth } from "@payloadcms/ui"
import type React from "react"
import { useEffect } from "react"

import { writeAdminBarHint } from "./hint"

/**
 * Wraps the admin panel, so logging in or out there sets the admin bar's hint, and the first page
 * of the site an editor opens afterwards already has room for the bar.
 */
export function AdminBarHintProvider({ children }: { children: React.ReactNode }): React.ReactNode {
  const { user } = useAuth()
  const loggedIn = Boolean(user)

  useEffect(() => {
    writeAdminBarHint(loggedIn)
  }, [loggedIn])

  return children
}
