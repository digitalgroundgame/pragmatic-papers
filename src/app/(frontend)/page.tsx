import type { Metadata } from "next"

import { homeStatic } from "@/endpoints/seed/home-static"
import { queryPageBySlug } from "@/data/queries"
import { draftMode } from "next/headers"
import { getGlobal } from "@/data/globals"

import { RenderBlocks } from "@/blocks/RenderBlocks"
import { JsonLd } from "@/components/JsonLd"
import { LivePreviewListener } from "@/components/LivePreviewListener"
import { RenderHero } from "@/heros/RenderHero"
import { generateMeta } from "@/utilities/generateMeta"
import { HOME_SLUG } from "@/utilities/routes"
import { buildHomeJsonLd } from "@/utilities/structuredData"

// The page slugged `home`, served here (`/home` redirects, next.config.ts). It reads no `?p=`,
// so unlike `/[slug]` it's prerendered and served from the cache. Saving it revalidates it, and
// so does a save that changes a page it can list from (an article, volume or contributor, or a
// topic or media they show: `shared` in revalidateForReaders). The hour is a backstop for what
// changes without a save, as on articles.
export const revalidate = 3600

export async function generateMetadata(): Promise<Metadata> {
  const page = await queryPageBySlug(HOME_SLUG)
  return generateMeta({ doc: page, canonicalPath: "/" })
}

export default async function HomePage(): Promise<React.ReactNode> {
  const { isEnabled: draft } = await draftMode()
  // Remove the fallback once your website is seeded
  const { hero, layout } = (await queryPageBySlug(HOME_SLUG)) ?? homeStatic
  const { socials } = await getGlobal("footer", 2)

  return (
    <article>
      <JsonLd data={buildHomeJsonLd(socials)} />
      {draft && <LivePreviewListener />}
      <RenderHero {...hero} />
      {/* A Volume View here lists the newest volumes: its `?p=` links can't be read. */}
      <RenderBlocks blocks={layout} paginated={false} />
    </article>
  )
}
