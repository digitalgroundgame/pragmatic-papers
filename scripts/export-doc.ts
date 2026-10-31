import "dotenv/config"
import { existsSync } from "node:fs"
import { copyFile, mkdir, readFile, rm, writeFile } from "node:fs/promises"
import path from "node:path"

import config from "@payload-config"
import { getPayload } from "payload"
import { format, resolveConfig } from "prettier"

import { formatDocFile, imagesIn, parseDocFile } from "@/plugins/docs/docFile"
import { contentToMarkdown, docsEditorConfig } from "@/plugins/docs/markdown"
import { packMedia, type MediaRef } from "@/plugins/docs/repoDoc"
import { DOCS_DIR, listDocFiles } from "@/plugins/docs/repoDocFiles"

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
 * `pnpm docs:export <slug>`: writes a doc written in the admin into the repo, at its place in the
 * tree, `src/docs/<area>/<section>/<slug>.md`, with the files it shows beside it (each named for
 * the doc, the hero image `<slug>-hero`), so the release that ships the feature ships its doc to
 * every site. Reads the latest draft, from the database in `.env`. The doc it sits under must be
 * in the repo already (export it first); a copy elsewhere is moved, keeping its `order`.
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

    const hero = doc.heroImage
    const heroName =
      hero && typeof hero === "object"
        ? `${slug}-hero${path.extname(hero.filename ?? ".webp")}`
        : null
    const names = new Map(hero && typeof hero === "object" && heroName ? [[hero.id, heroName]] : [])
    const { content: packed, media } = packMedia(
      slug,
      { heroImage: doc.heroImage, content: doc.content },
      names,
    )
    const { heroImage, content } = packed as { heroImage?: MediaRef | null; content: unknown }
    const body = contentToMarkdown(content, docsEditorConfig(payload.config))

    const meta = {
      title: doc.title,
      ...(doc.navTitle ? { navTitle: doc.navTitle } : {}),
      summary: doc.summary,
      publishedAt: doc.publishedAt.slice(0, 10),
      ...(doc.revisedAt ? { revisedAt: doc.revisedAt.slice(0, 10) } : {}),
      ...(heroImage ? { heroImage: heroImage.$media, heroAlt: heroImage.alt ?? "" } : {}),
      ...(doc.audience?.length ? { audience: doc.audience } : {}),
      ...(doc.showTableOfContents === false ? { showTableOfContents: false } : {}),
      ...(doc.tour ? { tour: doc.tour } : {}),
    }

    // Its folder is its ancestors' slugs, top first, as its breadcrumbs (the doc last) list them.
    const ancestors = (doc.breadcrumbs ?? [])
      .slice(0, -1)
      .map((crumb) => (typeof crumb.doc === "object" ? crumb.doc?.slug : null))
    if (ancestors.some((ancestor) => !ancestor)) {
      throw new Error(`"${slug}" sits under a doc that has no slug yet: save its parent first`)
    }
    const repo = await listDocFiles(DOCS_DIR)
    const parent = ancestors.at(-1)
    const above = parent ? repo.find((entry) => entry.slug === parent) : null
    if (parent && !above) {
      throw new Error(`"${slug}" sits under "${parent}", which isn't in src/docs/: export it first`)
    }
    const folder = above ? path.join(above.folder, above.slug) : DOCS_DIR
    const docPath = path.join(folder, `${slug}.md`)
    // A copy elsewhere is the doc before it moved: it goes, and its place among its siblings
    // comes along.
    const previous = repo.find((entry) => entry.slug === slug)
    const before = previous && parseDocFile(await readFile(previous.file, "utf8"), previous.file)
    const order = before ? before.meta.order : undefined
    if (previous && before && previous.file !== docPath) {
      if (existsSync(path.join(previous.folder, slug))) {
        throw new Error(
          `"${slug}" moved, and has docs under it in src/docs/: move its folder by hand first`,
        )
      }
      // With the files it showed, which are written again below.
      const shown = [before.meta.heroImage, ...imagesIn(before.body).map((image) => image.file)]
      for (const name of [`${slug}.md`, ...shown]) {
        if (name) await rm(path.join(previous.folder, name), { force: true })
      }
    }
    const markdown = formatDocFile({
      meta: { ...meta, ...(order === undefined ? {} : { order }) },
      body,
    })
    await mkdir(folder, { recursive: true })
    // As the commit hook would write it.
    const prettier = await resolveConfig(docPath)
    await writeFile(docPath, await format(markdown, { ...prettier, parser: "markdown" }))
    for (const [file, item] of media) {
      await saveMediaFile(item, path.join(folder, file))
    }
    console.warn(`✔ Wrote ${path.relative(process.cwd(), docPath)} (${media.size} files)`)
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
