import type { RequiredDataFromCollectionSlug } from "payload"

import type { Footer } from "@/payload-types"

import { RenderBlocks } from "@/blocks/RenderBlocks"
import { Breadcrumbs, type Crumb } from "@/components/Breadcrumbs"
import { JsonLd } from "@/components/JsonLd"
import { LivePreviewListener } from "@/components/LivePreviewListener"
import { PayloadRedirects } from "@/components/PayloadRedirects"
import { RenderHero } from "@/heros/RenderHero"
import { buildBreadcrumbJsonLd, buildHomeJsonLd } from "@/utilities/structuredData"

interface PageViewProps {
  page: RequiredDataFromCollectionSlug<"pages">
  slug: string
  /** The URL a redirect is looked up by. */
  url: string
  draft: boolean
  /** The Volume View's page, from `?p=`; omitted where the route doesn't read it. */
  pageNumber?: number
  /** The footer's social accounts, which the home page's structured data names. */
  socials: Footer["socials"]
}

/** A Pages document, as both the home page and `/[slug]` render it. */
export function PageView({
  page,
  slug,
  url,
  draft,
  pageNumber,
  socials,
}: PageViewProps): React.ReactNode {
  const { hero, layout } = page
  const home = slug === "home"

  // Flat today. Once pages nest, this is nestedDocsTrail(page.breadcrumbs).
  const trail: Crumb[] = home ? [] : [{ name: page.title, path: `/${slug}` }]
  const jsonLdData = home ? buildHomeJsonLd(socials) : [buildBreadcrumbJsonLd(trail)]
  return (
    <>
      <Breadcrumbs items={trail} />
      <article>
        <JsonLd data={jsonLdData} />
        {/* Allows redirects for valid pages too */}
        <PayloadRedirects disableNotFound url={url} />

        {draft && <LivePreviewListener />}

        <RenderHero {...hero} />

        <RenderBlocks blocks={layout} pageNumber={pageNumber} paginated={!home} />
      </article>
    </>
  )
}
