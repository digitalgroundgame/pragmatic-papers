import { existsSync } from "node:fs"
import { readdir, readFile } from "node:fs/promises"
import path from "node:path"

import { parseDocFile } from "./docFile"
import { HOME_DOC_SLUG } from "./sections"

/**
 * Where the repo keeps its docs, as the tree they make at /docs: each doc is `<slug>.md`, with
 * the files it shows beside it, and the docs under it in a `<slug>/` folder beside that, so
 * `writing/articles/footnotes.md` is the Footnotes doc in Articles, in Writing. The home doc,
 * `home.md`, is at the top. The build traces the folder into the image.
 */
export const DOCS_DIR = path.resolve(process.cwd(), "src/docs")

export interface DocFileEntry {
  slug: string
  /** The slug of the doc it sits under (its folder's); null at the top, and for the home doc. */
  parent: string | null
  /** The folder its file is in, where the files it shows are too. */
  folder: string
  file: string
  /** The doc's address under the docs path, from its folders and slug, with forward slashes on every OS. */
  urlPath: string
}

const orderOf = async (file: string, name: string): Promise<number> =>
  parseDocFile(await readFile(file, "utf8"), name).meta.order ?? Number.POSITIVE_INFINITY

/**
 * Every doc in `dir`, each before the docs under it, and siblings in their `order`, then by
 * slug: the order a new site seeds them in, and so their order in its sidebar. Throws on a
 * slug used twice, a folder with no doc beside it, or a home doc anywhere but the top.
 */
export async function listDocFiles(dir = DOCS_DIR): Promise<DocFileEntry[]> {
  const found: DocFileEntry[] = []
  const walk = async (folder: string, parent: string | null, parentUrl: string): Promise<void> => {
    const entries = await readdir(folder, { withFileTypes: true })
    const docs = entries.filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
    const slugs = new Set(docs.map((entry) => entry.name.slice(0, -".md".length)))
    for (const entry of entries) {
      if (entry.isDirectory() && !slugs.has(entry.name)) {
        const where = path.relative(dir, path.join(folder, entry.name))
        throw new Error(`src/docs/${where}/ holds docs, but there's no ${entry.name}.md beside it`)
      }
    }
    const ordered = await Promise.all(
      [...slugs].map(async (slug) => {
        const file = path.join(folder, `${slug}.md`)
        return { slug, file, order: await orderOf(file, path.relative(dir, file)) }
      }),
    )
    ordered.sort((a, b) => a.order - b.order || a.slug.localeCompare(b.slug))
    for (const { slug, file } of ordered) {
      if (slug === HOME_DOC_SLUG && parent !== null) {
        throw new Error(`src/docs/${path.relative(dir, file)}: the home doc belongs at the top`)
      }
      const twin = found.find((doc) => doc.slug === slug)
      if (twin) {
        throw new Error(
          `Two docs are called "${slug}": src/docs/${path.relative(dir, twin.file)} and src/docs/${path.relative(dir, file)}`,
        )
      }
      // Built from slugs with "/", so it's the same on every OS.
      const urlPath = parentUrl ? `${parentUrl}/${slug}` : slug
      found.push({ slug, parent, folder, file, urlPath })
      const below = path.join(folder, slug)
      if (existsSync(below)) {
        if (slug === HOME_DOC_SLUG)
          throw new Error("src/docs/home/: no docs sit under the home doc")
        await walk(below, slug, urlPath)
      }
    }
  }
  await walk(dir, null, "")
  return found
}
