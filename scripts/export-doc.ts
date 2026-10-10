import "dotenv/config"
import { existsSync } from "node:fs"
import { copyFile, mkdir, readdir, rm, writeFile } from "node:fs/promises"
import path from "node:path"

import config from "@payload-config"
import { getPayload } from "payload"
import { format, resolveConfig } from "prettier"

import { formatDocFile } from "@/plugins/docs/docFile"
import { contentToMarkdown, docsEditorConfig } from "@/plugins/docs/markdown"
import { packMedia, type MediaRef } from "@/plugins/docs/repoDoc"
import { DOCS_DIR } from "@/plugins/docs/syncDocs"

/** Copies the original upload: from public/media with local storage, otherwise from its URL. */
async function saveMediaFile(
  item: { filename: string; url?: string | null },
  destination: string,
): Promise<void> {
  const local = path.resolve(process.cwd(), "public/media", item.filename)
  if (existsSync(local)) {
    await copyFile(local, destination)
    return
  }
  if (!item.url) throw new Error(`${item.filename} has no file here and no URL`)
  const url = new URL(item.url, process.env.NEXT_PUBLIC_SERVER_URL || "http://localhost:8000")
  const response = await fetch(url)
  if (!response.ok) throw new Error(`Fetching ${url} failed: ${response.status}`)
  await writeFile(destination, Buffer.from(await response.arrayBuffer()))
}

/**
 * `pnpm docs:export <slug>`: writes a doc written in the admin into the repo, as
 * `src/docs/<section>/<slug>.md` with the files it shows beside it (each named for the doc, the
 * hero image `<slug>-hero`), so the release that ships the feature ships its doc to every site.
 * Reads the latest draft, from the database in `.env`. A doc in another section's folder is
 * moved.
 */
export async function main(slug: string | undefined): Promise<void> {
  if (!slug) throw new Error("Usage: pnpm docs:export <slug>")

  const payload = await getPayload({ config })
  try {
    const { docs } = await payload.find({
      collection: "docs",
      depth: 3,
      draft: true,
      limit: 1,
      overrideAccess: true,
      pagination: false,
      where: { slug: { equals: slug } },
    })
    const doc = docs[0]
    if (!doc) throw new Error(`No doc with the slug "${slug}"`)
    if (!doc.publishedAt) throw new Error(`"${slug}" has no published date yet`)

    if (!doc.heroImage) throw new Error(`"${slug}" has no hero image yet`)

    const hero = doc.heroImage
    const heroName =
      typeof hero === "object" ? `${slug}-hero${path.extname(hero.filename ?? ".webp")}` : null
    const names = new Map(typeof hero === "object" && heroName ? [[hero.id, heroName]] : [])
    const { content: packed, media } = packMedia(
      slug,
      { heroImage: doc.heroImage, content: doc.content },
      names,
    )
    const { heroImage, content } = packed as { heroImage: MediaRef; content: unknown }
    const body = contentToMarkdown(content, docsEditorConfig(payload.config))

    const markdown = formatDocFile({
      meta: {
        title: doc.title,
        ...(doc.navTitle ? { navTitle: doc.navTitle } : {}),
        summary: doc.summary,
        publishedAt: doc.publishedAt.slice(0, 10),
        ...(doc.revisedAt ? { revisedAt: doc.revisedAt.slice(0, 10) } : {}),
        heroImage: heroImage.$media,
        heroAlt: heroImage.alt ?? "",
        ...(doc.audience?.length ? { audience: doc.audience } : {}),
        ...(doc.showTableOfContents === false ? { showTableOfContents: false } : {}),
      },
      body,
    })

    const folder = path.join(DOCS_DIR, doc.section)
    await mkdir(folder, { recursive: true })
    for (const other of await readdir(DOCS_DIR, { withFileTypes: true })) {
      if (other.isDirectory() && other.name !== doc.section) {
        await rm(path.join(DOCS_DIR, other.name, `${slug}.md`), { force: true })
      }
    }
    // As the commit hook would write it.
    const docPath = path.join(folder, `${slug}.md`)
    const prettier = await resolveConfig(docPath)
    await writeFile(docPath, await format(markdown, { ...prettier, parser: "markdown" }))
    for (const [file, item] of media) {
      await saveMediaFile(item, path.join(folder, file))
    }
    console.warn(
      `✔ Wrote ${path.relative(process.cwd(), path.join(folder, `${slug}.md`))} (${media.size} files)`,
    )
  } finally {
    await payload.db.destroy?.()
  }
}

if (process.argv[1] === import.meta.filename) {
  main(process.argv[2]).then(
    () => process.exit(0),
    (err: unknown) => {
      console.error(err instanceof Error ? err.message : err)
      process.exit(1)
    },
  )
}
