import type { Payload } from "payload"
import type React from "react"

import { isPluginOn } from "@/utilities/registerPlugin"

import { TourProvider } from "./TourProvider"
import type { ToursOptions } from "./types"

/**
 * The admin's provider for tours. Checks the plugin's `enabled` on each admin page and only then
 * mounts `TourProvider`, so with tours off a `?tour=` link does nothing.
 */
export async function TourGate({
  children,
  payload,
}: {
  children: React.ReactNode
  payload: Payload
}): Promise<React.ReactNode> {
  const options = payload.config.custom?.tours as ToursOptions | undefined
  if (!(await isPluginOn(options?.enabled, payload))) return children
  return <TourProvider>{children}</TourProvider>
}
