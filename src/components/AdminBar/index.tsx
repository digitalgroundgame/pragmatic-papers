import { draftMode } from "next/headers"
import React from "react"

import { LazyAdminBar } from "./client.lazy"

/**
 * Reads only draft mode, which a prerender sees as off, so the layout this sits in can still be
 * prerendered. Who is logged in, and which document the page shows, the client asks Payload for;
 * the bar itself loads only once someone is.
 */
export async function AdminBar(): Promise<React.ReactNode> {
  const { isEnabled } = await draftMode()
  return <LazyAdminBar preview={isEnabled} />
}
