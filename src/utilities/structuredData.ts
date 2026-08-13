import type { Article, Media, MenuField, Topic, User, Volume } from "@/payload-types"
import { getMediaUrl } from "@/utilities/getMediaUrl"
import { getServerSideURL } from "@/utilities/getURL"
import { convertLexicalToPlaintext } from "@payloadcms/richtext-lexical/plaintext"
import type {
  ArticleLeaf,
  BreadcrumbListLeaf,
  CollectionPageLeaf,
  OrganizationLeaf,
  PeriodicalLeaf,
  PersonLeaf,
  PublicationVolumeLeaf,
  Thing,
  WebSiteLeaf,
} from "schema-dts"

const SERVER_URL = getServerSideURL()
const SITE_NAME = "The Pragmatic Papers"
const SITE_DESCRIPTION =
  "Pragmatic, community-driven articles focusing on news, politics, economics, and more."

// Stable @id IRIs for core entities — used for cross-referencing across pages
const ORG_ID = `${SERVER_URL}/#organization`
const SITE_ID = `${SERVER_URL}/#website`
const PERIODICAL_ID = `${SERVER_URL}/#periodical`

export type JsonLdData = Thing

function getImageUrl(media: Media | number | null | undefined): string | undefined {
  if (!media || typeof media === "number") return undefined
  return getMediaUrl(media.sizes?.og?.url || media.url) || undefined
}

export function buildArticleJsonLd(
  article: Article,
  path: string,
  volume?: Pick<Volume, "id" | "slug" | "title" | "volumeNumber" | "publishedAt"> | null,
): ArticleLeaf {
  const fullUrl = `${SERVER_URL}${path}`

  const authors = (article.authors || [])
    .filter((author): author is User => typeof author === "object")
    .map(
      (author): PersonLeaf => ({
        "@type": "Person",
        "@id": `${SERVER_URL}/authors/${author.slug}`,
        name: author.name || undefined,
        url: `${SERVER_URL}/authors/${author.slug}`,
      }),
    )

  const keywords = (article.topics || [])
    .filter((t): t is Topic => typeof t !== "number")
    .map((t) => t.name)

  const image = getImageUrl(article.meta?.image || article.heroImage)

  return {
    "@type": "Article",
    "@id": `${fullUrl}#article`,
    headline: article.meta?.title || article.title || undefined,
    description: article.meta?.description || undefined,
    datePublished: article.publishedAt ?? article.createdAt,
    dateModified: article.updatedAt,
    inLanguage: "en-US",
    isAccessibleForFree: true,
    keywords: keywords.length > 0 ? keywords.join(", ") : undefined,
    author: authors.length > 0 ? authors : undefined,
    publisher: { "@type": "Organization", "@id": ORG_ID } satisfies OrganizationLeaf,
    isPartOf: volume?.id
      ? ({
          "@type": "PublicationVolume",
          "@id": volume.slug ? `${SERVER_URL}/volumes/${volume.slug}#volume` : undefined,
          name: volume.title ?? `Volume ${volume.volumeNumber}`,
          volumeNumber: volume.volumeNumber ?? undefined,
          isPartOf: { "@type": "Periodical", "@id": PERIODICAL_ID } satisfies PeriodicalLeaf,
        } satisfies PublicationVolumeLeaf)
      : undefined,
    image: image || undefined,
    mainEntityOfPage: { "@type": "WebPage", "@id": fullUrl },
  }
}

export function buildOrganizationJsonLd(sameAs?: string[]): OrganizationLeaf {
  return {
    "@type": "Organization",
    "@id": ORG_ID,
    name: SITE_NAME,
    url: SERVER_URL,
    logo: {
      "@type": "ImageObject",
      url: `${SERVER_URL}/the-pragmatic-papers-opengraph-image.png`,
    },
    description: SITE_DESCRIPTION,
    sameAs: sameAs && sameAs.length > 0 ? sameAs : undefined,
  }
}

export function buildWebSiteJsonLd(): WebSiteLeaf {
  return {
    "@type": "WebSite",
    "@id": SITE_ID,
    name: SITE_NAME,
    url: SERVER_URL,
  }
}

export function buildPeriodicalJsonLd(): PeriodicalLeaf {
  return {
    "@type": "Periodical",
    "@id": PERIODICAL_ID,
    name: SITE_NAME,
    description: SITE_DESCRIPTION,
    url: SERVER_URL,
    publisher: { "@type": "Organization", "@id": ORG_ID } satisfies OrganizationLeaf,
  }
}

export function buildPersonJsonLd(user: User, path: string): PersonLeaf {
  const fullUrl = `${SERVER_URL}${path}`
  const image = getImageUrl(user.profileImage)
  const sameAs = (user.socials || [])
    .map((s) => (s.link?.type === "custom" ? s.link.url : null))
    .filter((u): u is string => Boolean(u))

  return {
    "@type": "Person",
    "@id": fullUrl,
    name: user.name || undefined,
    url: fullUrl,
    description: user.biography
      ? convertLexicalToPlaintext({ data: user.biography }) || undefined
      : undefined,
    image: image || undefined,
    sameAs: sameAs.length > 0 ? sameAs : undefined,
    affiliation: user.affiliation ? { "@type": "Organization", name: user.affiliation } : undefined,
  }
}

export function buildBreadcrumbJsonLd(
  items?: { name: string; path: string }[],
): BreadcrumbListLeaf {
  const allItems = [
    { name: "Home", item: SERVER_URL },
    ...(items ?? []).map((item) => ({ name: item.name, item: `${SERVER_URL}${item.path}` })),
  ]
  return {
    "@type": "BreadcrumbList",
    itemListElement: allItems.map((entry, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: entry.name,
      item: entry.item,
    })),
  }
}

export function buildCollectionPageJsonLd(
  title: string,
  description: string,
  path: string,
): CollectionPageLeaf {
  return {
    "@type": "CollectionPage",
    name: title,
    description,
    url: `${SERVER_URL}${path}`,
  }
}

export function buildHomeJsonLd(socials?: MenuField): Thing[] {
  const sameAs = (socials || [])
    .map((s) => (s.link?.type === "custom" ? s.link.url : null))
    .filter((s): s is string => Boolean(s))
  return [
    buildWebSiteJsonLd(),
    buildOrganizationJsonLd(sameAs.length > 0 ? sameAs : undefined),
    buildPeriodicalJsonLd(),
    buildBreadcrumbJsonLd(),
  ]
}

export function buildVolumeJsonLd(volume: Volume, path: string): PublicationVolumeLeaf {
  const fullUrl = `${SERVER_URL}${path}`
  return {
    "@type": "PublicationVolume",
    "@id": `${fullUrl}#volume`,
    name: volume.title,
    description: volume.description || undefined,
    volumeNumber: volume.volumeNumber,
    datePublished: volume.publishedAt ?? undefined,
    url: fullUrl,
    isPartOf: { "@type": "Periodical", "@id": PERIODICAL_ID } satisfies PeriodicalLeaf,
  }
}
