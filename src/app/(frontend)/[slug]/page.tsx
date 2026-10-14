import type { Metadata } from "next"

import { PayloadRedirects } from "@/components/PayloadRedirects"
import { queryPageBySlug } from "@/data/queries"
import { draftMode } from "next/headers"

import { RenderBlocks } from "@/blocks/RenderBlocks"
import { JsonLd } from "@/components/JsonLd"
import { LivePreviewListener } from "@/components/LivePreviewListener"
import { RenderHero } from "@/heros/RenderHero"
import { generateMeta, paginatedPath } from "@/utilities/generateMeta"
import { buildBreadcrumbJsonLd } from "@/utilities/structuredData"
import { Breadcrumbs, type Crumb } from "@/components/Breadcrumbs"

// Paginated with `?p=`, which only a request carries, so this is rendered per request. That's
// also why there's no generateStaticParams: a prerendered slug would never be served. The home
// page is `../page.tsx`, prerendered, and `/home` redirects there (next.config.ts).
export const dynamic = "force-dynamic"

export async function generateMetadata({
  params: paramsPromise,
  searchParams,
}: Args): Promise<Metadata> {
  const { slug } = await paramsPromise
  const { p } = await searchParams
  const page = await queryPageBySlug(slug)

  // Only a page with a volume list is paginated; anywhere else `?p=` changes nothing.
  const paginated = page?.layout?.some((block) => block.blockType === "volumeView")
  const canonicalPath = paginated ? paginatedPath(`/${slug}`, p) : `/${slug}`
  return generateMeta({ doc: page, canonicalPath })
}

interface Args {
  params: Promise<{
    slug: string
  }>
  searchParams: Promise<{
    p?: string
  }>
}

export default async function Page({ params, searchParams }: Args): Promise<React.ReactNode> {
  const { isEnabled: draft } = await draftMode()
  const { slug } = await params
  const { p: pageString } = await searchParams
  const pageNumber = pageString ? Math.max(Number(pageString) || 1, 1) : undefined
  const url = `/${slug}${pageNumber ? `?p=${pageNumber}` : ""}`
  const page = await queryPageBySlug(slug)

  if (!page) {
    return <PayloadRedirects url={url} />
  }

  const { hero, layout } = page

  // Flat today. Once pages nest, this is nestedDocsTrail(page.breadcrumbs).
  const trail: Crumb[] = [{ name: page.title, path: `/${slug}` }]
  return (
    <>
      <Breadcrumbs items={trail} />
      <article>
        <JsonLd data={[buildBreadcrumbJsonLd(trail)]} />
        {/* Allows redirects for valid pages too */}
        <PayloadRedirects disableNotFound url={url} />

        {draft && <LivePreviewListener />}

        <RenderHero {...hero} />

        <RenderBlocks blocks={layout} pageNumber={pageNumber} />
      </article>
    </>
  )
}
