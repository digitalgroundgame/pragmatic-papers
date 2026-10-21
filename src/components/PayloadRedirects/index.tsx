import type React from "react"

import { getRedirects } from "./getRedirects"
import { isResolved } from "@/utilities/relationships"
import { docPath } from "@/utilities/routes"
import { notFound, permanentRedirect } from "next/navigation"

interface Props {
  disableNotFound?: boolean
  url: string
}

/**
 * Sends a request for `url` to wherever its redirect in the Redirects collection points.
 * Redirects are permanent (308), so search engines move the old address's ranking to the
 * new one.
 */
export const PayloadRedirects: React.FC<Props> = async ({ disableNotFound, url }) => {
  const redirects = await getRedirects()

  const redirectItem = redirects.find((redirect) => redirect.from === url)

  if (redirectItem) {
    if (redirectItem.to?.url) {
      permanentRedirect(redirectItem.to.url)
    }

    // The redirects are read at depth 1, so a reference arrives as the document.
    const reference = redirectItem.to?.reference
    if (reference && isResolved(reference.value) && reference.value.slug) {
      permanentRedirect(docPath(reference.relationTo, reference.value.slug))
    }
  }

  if (disableNotFound) return null

  notFound()
}
