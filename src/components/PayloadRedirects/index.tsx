import type React from "react"

import { getCachedRedirects } from "@/utilities/getRedirects"
import { isResolved } from "@/utilities/relationships"
import { docPath } from "@/utilities/routes"
import { notFound, redirect } from "next/navigation"

interface Props {
  disableNotFound?: boolean
  url: string
}

/* This component helps us with SSR based dynamic redirects */
export const PayloadRedirects: React.FC<Props> = async ({ disableNotFound, url }) => {
  const redirects = await getCachedRedirects()()

  // eslint-disable-next-line @typescript-eslint/no-shadow
  const redirectItem = redirects.find((redirect) => redirect.from === url)

  if (redirectItem) {
    if (redirectItem.to?.url) {
      redirect(redirectItem.to.url)
    }

    // The redirects are read at depth 1, so a reference arrives as the document.
    const reference = redirectItem.to?.reference
    if (reference && isResolved(reference.value) && reference.value.slug) {
      redirect(docPath(reference.relationTo, reference.value.slug))
    }
  }

  if (disableNotFound) return null

  notFound()
}
