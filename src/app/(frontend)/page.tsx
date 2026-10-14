import type { Metadata } from "next"

import { homeStatic } from "@/endpoints/seed/home-static"
import { queryPageBySlug } from "@/data/queries"
import { draftMode } from "next/headers"
import { getGlobal } from "@/data/globals"

import { generateMeta } from "@/utilities/generateMeta"
import { PageView } from "./[slug]/PageView"

// The home page reads no `?p=`, so unlike `/[slug]` it's prerendered and served from the cache.
// Saving the home page revalidates it, and so does a save to anything it can list (articles,
// volumes, contributors, topics, media: `shared` in revalidateForReaders). The hour is a
// backstop for what changes without a save, as on articles.
export const revalidate = 3600

export async function generateMetadata(): Promise<Metadata> {
  const page = await queryPageBySlug("home")
  return generateMeta({ doc: page, canonicalPath: "/" })
}

export default async function HomePage(): Promise<React.ReactNode> {
  const { isEnabled: draft } = await draftMode()
  // Remove the fallback once your website is seeded
  const page = (await queryPageBySlug("home")) ?? homeStatic

  const { socials } = await getGlobal("footer", 2)

  return <PageView page={page} slug="home" url="/home" draft={draft} socials={socials} />
}
