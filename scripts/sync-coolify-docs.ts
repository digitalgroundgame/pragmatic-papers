/**
 * Refreshes the copy of Coolify's documentation in docs/vendor/coolify, so people and
 * agents can read how our host works without reaching coolify.io (which cloud agent
 * sessions can't). Run under plain Node 24:
 *
 *   pnpm docs:coolify            # the newest commit on the manifest's ref
 *   pnpm docs:coolify <commit>   # a specific commit
 *
 * docs/vendor/coolify/manifest.json lists the pages we keep, as paths under
 * coolify-docs' content/docs. Add a page there and rerun to bring it in; remove one and
 * its file is deleted. Every page comes from the same commit, recorded in the manifest.
 * Pages are copied unchanged (Apache-2.0; see docs/vendor/coolify/LICENSE).
 */
import { execFileSync } from "node:child_process"
import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { dirname, join, relative, resolve } from "node:path"
import { pathToFileURL } from "node:url"

export const VENDOR_DIR = resolve(import.meta.dirname, "../docs/vendor/coolify")

export interface Manifest {
  repository: string
  ref: string
  commit: string
  source: string
  pages: string[]
}

export function rawUrl(manifest: Manifest, commit: string, path: string): string {
  const repo = new URL(manifest.repository).pathname.replace(/^\/|\.git$/g, "")
  return `https://raw.githubusercontent.com/${repo}/${commit}/${path}`
}

/** Files under `pages/` that the manifest no longer lists. */
export function staleFiles(existing: string[], pages: string[]): string[] {
  const wanted = new Set(pages)
  return existing.filter((file) => !wanted.has(file))
}

export function validatePages(pages: string[]): void {
  for (const page of pages) {
    if (page.startsWith("/") || page.split("/").includes("..") || !/\.mdx?$/.test(page)) {
      throw new Error(`Not a docs page path: ${page}`)
    }
  }
  const duplicates = pages.filter((page, i) => pages.indexOf(page) !== i)
  if (duplicates.length) throw new Error(`Listed twice: ${duplicates.join(", ")}`)
}

function listFiles(dir: string, root = dir): string[] {
  let entries
  try {
    entries = readdirSync(dir, { withFileTypes: true })
  } catch {
    return []
  }
  return entries.flatMap((entry) =>
    entry.isDirectory()
      ? listFiles(join(dir, entry.name), root)
      : [relative(root, join(dir, entry.name))],
  )
}

function resolveCommit(manifest: Manifest): string {
  // git works where the GitHub API is rate-limited or blocked.
  const out = execFileSync(
    "git",
    ["ls-remote", manifest.repository, `refs/heads/${manifest.ref}`],
    {
      encoding: "utf-8",
    },
  )
  const commit = out.split(/\s/)[0]
  if (!commit) throw new Error(`No branch "${manifest.ref}" in ${manifest.repository}`)
  return commit
}

async function download(url: string): Promise<string> {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`${response.status} for ${url}`)
  return response.text()
}

export async function main(args: string[]): Promise<number> {
  const manifestPath = join(VENDOR_DIR, "manifest.json")
  const manifest = JSON.parse(readFileSync(manifestPath, "utf-8")) as Manifest
  validatePages(manifest.pages)
  const commit = args[0] ?? resolveCommit(manifest)
  console.warn(`Coolify docs at ${commit.slice(0, 12)}: ${manifest.pages.length} pages`)

  // Download everything before writing anything, so a missing page leaves the copy as it was.
  const results = await Promise.allSettled(
    manifest.pages.map((page) => download(rawUrl(manifest, commit, `${manifest.source}/${page}`))),
  )
  const missing = manifest.pages.filter((_, i) => results[i]!.status === "rejected")
  if (missing.length) {
    console.error(
      `Couldn't fetch ${missing.length} page(s), which may have moved upstream:\n` +
        missing.map((page) => `  ${page}`).join("\n") +
        "\nFix their paths in docs/vendor/coolify/manifest.json and rerun.",
    )
    return 1
  }
  const license = await download(rawUrl(manifest, commit, "LICENSE"))

  const pagesDir = join(VENDOR_DIR, "pages")
  for (const file of staleFiles(listFiles(pagesDir), manifest.pages)) {
    rmSync(join(pagesDir, file))
    console.warn(`Removed ${file}`)
  }
  manifest.pages.forEach((page, i) => {
    const target = join(pagesDir, page)
    mkdirSync(dirname(target), { recursive: true })
    writeFileSync(target, (results[i] as PromiseFulfilledResult<string>).value)
  })
  writeFileSync(join(VENDOR_DIR, "LICENSE"), license)
  writeFileSync(manifestPath, `${JSON.stringify({ ...manifest, commit }, null, 2)}\n`)
  console.warn("Done. Review the diff before committing.")
  return 0
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = await main(process.argv.slice(2))
}
