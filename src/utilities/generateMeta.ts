import type { Metadata } from "next"

import type { Article, Interactive, Page, Topic, Volume } from "../payload-types"

import { getMediaUrl } from "./getMediaUrl"
import { getSiteURL } from "./getURL"
import { DEFAULT_DESCRIPTION, mergeOpenGraph } from "./mergeOpenGraph"

// A listing paginated with `?p=` is a different page from its first one, so each page names
// itself as canonical. Pointing page 2 at page 1 would tell Google to drop what's only on page 2.
export const paginatedPath = (path: string, p: string | undefined): string => {
  const page = Number(p)
  return Number.isInteger(page) && page > 1 ? `${path}?p=${page}` : path
}

export const generateMeta = async (args: {
  doc:
    | Partial<Page>
    | Partial<Volume>
    | Partial<Article>
    | Partial<Topic>
    | Partial<Interactive>
    | null
  canonicalPath: string
}): Promise<Metadata> => {
  const { doc, canonicalPath } = args
  const ogImage =
    typeof doc?.meta?.image === "object" ? getMediaUrl(doc?.meta?.image?.sizes?.og?.url) : undefined

  const title = doc?.meta?.title ? doc?.meta?.title : "The Pragmatic Papers"
  const canonicalUrl = `${getSiteURL()}${canonicalPath}`
  const description = doc?.meta?.description || DEFAULT_DESCRIPTION

  return {
    alternates: {
      canonical: canonicalUrl,
    },
    description,
    openGraph: mergeOpenGraph({
      description,
      images: ogImage
        ? [
            {
              url: ogImage,
            },
          ]
        : undefined,
      title,
      url: canonicalUrl,
    }),
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: ogImage ? [ogImage] : undefined,
    },
    title,
  }
}
