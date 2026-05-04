// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { PayloadRequest, CollectionSlug } from "payload"

const collectionPrefixMap: Partial<Record<CollectionSlug, string>> = {
  pages: "",
  articles: "/articles",
  volumes: "/volumes",
}

// eslint-disable-next-line @typescript-eslint/consistent-type-definitions
type Props = {
  collection: keyof typeof collectionPrefixMap
  slug: string
  req: PayloadRequest
}

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export const generatePreviewPath = ({ collection, slug }: Props) => {
  // Allow empty strings, e.g. for the homepage
  if (slug === undefined || slug === null) {
    return null
  }
  const encodedParams = new URLSearchParams({
    slug: slug, // URLSearchParams handles encoding; no need to pre-encode
    collection,
    path: `${collectionPrefixMap[collection]}/${slug}`,
    previewSecret: process.env.PREVIEW_SECRET || "",
  })

  const url = `/next/preview?${encodedParams.toString()}`

  return url
}
