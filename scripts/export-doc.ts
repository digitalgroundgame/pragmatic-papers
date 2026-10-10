import "dotenv/config"
import { existsSync } from "node:fs"
import { copyFile, mkdir, writeFile } from "node:fs/promises"
import path from "node:path"

import config from "@payload-config"
import { getPayload } from "payload"

import { DOCS_DIR } from "@/plugins/docs/syncDocs"
import { packMedia, type RepoDoc } from "@/plugins/docs/repoDoc"

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
 * `pnpm docs:export <slug>`: writes a doc written in the admin into the repo, at
 * `src/docs/<slug>/doc.json` with the files it shows beside it, so the release that ships the
 * feature ships its doc to every site. Reads the latest draft, from the database in `.env`.
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

    const { content: packed, media } = packMedia(slug, {
      heroImage: doc.heroImage,
      content: doc.content,
    })
    const { heroImage, content } = packed as Pick<RepoDoc, "heroImage" | "content">
    const repoDoc: RepoDoc = {
      title: doc.title,
      summary: doc.summary,
      publishedAt: doc.publishedAt.slice(0, 10),
      heroImage,
      ...(doc.audience?.length ? { audience: doc.audience } : {}),
      ...(doc.showTableOfContents === false ? { showTableOfContents: false } : {}),
      content,
    }

    const folder = path.join(DOCS_DIR, slug)
    await mkdir(folder, { recursive: true })
    await writeFile(path.join(folder, "doc.json"), `${JSON.stringify(repoDoc, null, 2)}\n`)
    for (const [file, item] of media) {
      await saveMediaFile(item, path.join(folder, file))
    }
    console.warn(`✔ Wrote ${path.relative(process.cwd(), folder)} (${media.size} files)`)
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
