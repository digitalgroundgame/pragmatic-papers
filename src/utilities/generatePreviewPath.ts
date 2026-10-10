// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { PayloadRequest } from "payload"

import { COLLECTION_PATHS, type RoutedCollection } from "./routes"

// eslint-disable-next-line @typescript-eslint/consistent-type-definitions
type Props = {
  collection: RoutedCollection
  slug: string
  req: PayloadRequest
}

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export const generatePreviewPath = ({ collection, slug }: Props) => {
  // Allow empty strings, e.g. for the homepage
  if (slug === undefined || slug === null) {
    return null
  }
  // Encode to support slugs with special characters
  const encodedSlug = encodeURIComponent(slug)

  const encodedParams = new URLSearchParams({
    slug: encodedSlug,
    collection,
    path: `${COLLECTION_PATHS[collection]}/${encodedSlug}`,
    previewSecret: process.env.PREVIEW_SECRET || "",
  })

  const url = `/next/preview?${encodedParams.toString()}`

  return url
}
