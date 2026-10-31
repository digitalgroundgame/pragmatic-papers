/**
 * Writes the block picker's images (`src/blocks/blockImages/art.tsx`) to
 * `public/block-images/`, and deletes any there that no block draws any more.
 * `--check` writes nothing and exits 1 when the folder doesn't match the art.
 */
import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import process from "node:process"
import { fileURLToPath } from "node:url"

import { renderBlockImages } from "../src/blocks/blockImages/render"

const dir = resolve(dirname(fileURLToPath(import.meta.url)), "../public/block-images")
const check = process.argv.includes("--check")

const files = renderBlockImages()
mkdirSync(dir, { recursive: true })
const onDisk = readdirSync(dir).filter((name) => name.endsWith(".svg"))

const stale = onDisk.filter((name) => !(name in files))
const changed = Object.entries(files).filter(([name, svg]) => {
  try {
    return readFileSync(join(dir, name), "utf8") !== svg
  } catch {
    return true
  }
})

if (check) {
  if (stale.length || changed.length) {
    for (const file of [...changed.map(([name]) => name), ...stale]) console.error(`  ${file}`)
    console.error("public/block-images/ is out of date: run `pnpm block-images`.")
    process.exit(1)
  }
  console.warn("public/block-images/ matches the art.")
} else {
  for (const [name, svg] of changed) writeFileSync(join(dir, name), svg)
  for (const name of stale) rmSync(join(dir, name))
  console.warn(`Wrote ${changed.length} and deleted ${stale.length} block images.`)
}
