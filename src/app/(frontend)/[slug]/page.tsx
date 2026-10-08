import type { Metadata } from "next"

import { PayloadRedirects } from "@/components/PayloadRedirects"
import { homeStatic } from "@/endpoints/seed/home-static"
import { queryPageBySlug } from "@/utilities/queries"
import { draftMode } from "next/headers"
import type { RequiredDataFromCollectionSlug } from "payload"

import { RenderBlocks } from "@/blocks/RenderBlocks"
import { JsonLd } from "@/components/JsonLd"
import { LivePreviewListener } from "@/components/LivePreviewListener"
import { RenderHero } from "@/heros/RenderHero"
import { generateMeta, paginatedPath } from "@/utilities/generateMeta"
import { getCachedGlobal } from "@/utilities/getGlobals"
import { buildBreadcrumbJsonLd, buildHomeJsonLd } from "@/utilities/structuredData"
import { Breadcrumbs, type Crumb } from "@/components/Breadcrumbs"

// Paginated with `?p=`, which only a request carries, so this is rendered per request. That's
// also why there's no generateStaticParams: a prerendered slug would never be served.
export const dynamic = "force-dynamic"

export async function generateMetadata({
  params: paramsPromise,
  searchParams,
}: Args): Promise<Metadata> {
  const { slug = "home" } = await paramsPromise
  const { p } = await searchParams
  const page = await queryPageBySlug(slug)

  const path = slug === "home" ? "/" : `/${slug}`
  // Only a page with a volume list is paginated; anywhere else `?p=` changes nothing.
  const paginated = page?.layout?.some((block) => block.blockType === "volumeView")
  const canonicalPath = paginated ? paginatedPath(path, p) : path
  return generateMeta({ doc: page, canonicalPath })
}

interface Args {
  params: Promise<{
    slug?: string
  }>
  searchParams: Promise<{
    p?: string
  }>
}

export default async function Page({ params, searchParams }: Args): Promise<React.ReactNode> {
  const { isEnabled: draft } = await draftMode()
  const { slug = "home" } = await params
  const { p: pageString } = await searchParams
  const pageNumber = pageString ? Math.max(Number(pageString) || 1, 1) : undefined
  const url = `/${slug}${pageNumber ? `?p=${pageNumber}` : ""}`
  let page: RequiredDataFromCollectionSlug<"pages"> | null = await queryPageBySlug(slug)
  const { socials } = await getCachedGlobal("footer", 2)()

  // Remove this code once your website is seeded
  if (!page && slug === "home") {
    page = homeStatic
  }

  if (!page) {
    return <PayloadRedirects url={url} />
  }

  const { hero, layout } = page

  // Flat today. Once pages nest, this is nestedDocsTrail(page.breadcrumbs).
  const trail: Crumb[] = slug === "home" ? [] : [{ name: page.title, path: `/${slug}` }]
  const jsonLdData = slug === "home" ? buildHomeJsonLd(socials) : [buildBreadcrumbJsonLd(trail)]
  return (
    <>
      <Breadcrumbs items={trail} />
      <article>
        <JsonLd data={jsonLdData} />
        {/* Allows redirects for valid pages too */}
        <PayloadRedirects disableNotFound url={url} />

        {draft && <LivePreviewListener />}

        <RenderHero {...hero} />

        <RenderBlocks blocks={layout} pageNumber={pageNumber} />
      </article>
    </>
  )
}
