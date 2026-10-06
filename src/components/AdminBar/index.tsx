import { draftMode } from "next/headers"
import React from "react"

import { AdminBarClient } from "./client"

/**
 * Reads only draft mode, which a prerender sees as off, so the layout this sits in can still be
 * prerendered. Who is logged in, and which document the page shows, the client asks Payload for.
 */
export async function AdminBar(): Promise<React.ReactNode> {
  const { isEnabled } = await draftMode()
  return <AdminBarClient preview={isEnabled} />
}
