import { draftMode } from "next/headers"
import React from "react"

import { LazyAdminBar } from "./client.lazy"
import { ADMIN_BAR_HINT_SCRIPT } from "./hint"

/**
 * Reads only draft mode, which a prerender sees as off, so the layout this sits in can still be
 * prerendered. Who is logged in, and which document the page shows, the client asks Payload for;
 * the bar itself loads only once someone is.
 */
export async function AdminBar(): Promise<React.ReactNode> {
  const { isEnabled } = await draftMode()
  return <LazyAdminBar preview={isEnabled} />
}

/**
 * Goes in `<head>` beside `AdminBar`, so a page makes room for the bar before it paints when the
 * last one saw someone logged in.
 */
export function AdminBarHint(): React.ReactNode {
  // eslint-disable-next-line react/no-danger -- a constant, with nothing from the request in it
  return <script dangerouslySetInnerHTML={{ __html: ADMIN_BAR_HINT_SCRIPT }} />
}
