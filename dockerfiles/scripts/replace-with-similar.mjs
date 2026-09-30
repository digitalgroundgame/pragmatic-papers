// Replaces staging media that has no original left with a similar Unsplash photo,
// under the exact filenames the database lists: the original and every size.
// Run inside the staging container, as its own user:
//   docker exec -i -e DRY_RUN=1 -e UNSPLASH_ACCESS_KEY=... <container> node --input-type=module - < replace-with-similar.mjs
// DRY_RUN=1 prints the photo it would use for each item. To use a different one,
// pass its Unsplash id per media id: -e PICK="6=abc123XYZ_-,35=..."
// Only files change; the media's alt text and captions stay as they are.
import { createRequire } from "node:module"
import { renameSync, writeFileSync } from "node:fs"

const require = createRequire("/app/")
const sharp = require("sharp")
const DIR = "/app/public/media"
const PAYLOAD = `http://127.0.0.1:${process.env.PORT || 3000}/api/media?limit=500&depth=0`
const UNSPLASH = process.env.UNSPLASH_API || "https://api.unsplash.com"
const { UNSPLASH_ACCESS_KEY: KEY, DRY_RUN } = process.env
const FORMATS = { jpg: "jpeg", jpeg: "jpeg", png: "png", webp: "webp", avif: "avif" }

// Media id -> what to search for, from each item's alt text and caption.
const WANTED = {
  35: { query: "woman portrait film", orientation: "portrait" },
  6: { query: "dog", orientation: "portrait" },
  4: { query: "man headshot portrait", orientation: "squarish" },
  2: { query: "federal agent", orientation: "landscape" },
  1: { query: "confused person", orientation: "portrait" },
  45: { query: "confused person", orientation: "portrait" },
}
const PICK = Object.fromEntries(
  (process.env.PICK || "")
    .split(",")
    .filter(Boolean)
    .map((pair) => pair.split("=").map((part) => part.trim())),
)

if (!KEY) {
  console.error("Set UNSPLASH_ACCESS_KEY (see the top of this file).")
  process.exit(1)
}
const auth = { Authorization: `Client-ID ${KEY}`, "Accept-Version": "v1" }

async function fetchOk(url, headers = {}) {
  const res = await fetch(url, { headers, signal: AbortSignal.timeout(60_000) })
  if (!res.ok) throw new Error(`${res.status} from ${url.split("?")[0]}`)
  return res
}

const used = new Set()
async function choose(mediaId) {
  if (PICK[mediaId]) {
    return (await fetchOk(`${UNSPLASH}/photos/${PICK[mediaId]}`, auth)).json()
  }
  const { query, orientation } = WANTED[mediaId]
  const params = new URLSearchParams({ query, orientation, per_page: "10", content_filter: "high" })
  const { results } = await (await fetchOk(`${UNSPLASH}/search/photos?${params}`, auth)).json()
  // Two items searching for the same thing get different photos.
  const photo = results.find((result) => !used.has(result.id))
  if (!photo) throw new Error(`no results for "${query}"`)
  return photo
}

// Cover-crop to the recorded size around the focal point, as the stored variants were.
async function render(input, filename, width, height, focalX, focalY) {
  const meta = await sharp(input).rotate().metadata()
  const [w0, h0] = meta.orientation >= 5 ? [meta.height, meta.width] : [meta.width, meta.height]
  const scale = Math.max(width / w0, height / h0)
  const w = Math.max(width, Math.round(w0 * scale))
  const h = Math.max(height, Math.round(h0 * scale))
  const left = Math.min(w - width, Math.max(0, Math.round((w * (focalX ?? 50)) / 100 - width / 2)))
  const top = Math.min(h - height, Math.max(0, Math.round((h * (focalY ?? 50)) / 100 - height / 2)))
  return sharp(input)
    .rotate()
    .resize(w, h)
    .extract({ left, top, width, height })
    .toFormat(FORMATS[filename.split(".").pop().toLowerCase()] ?? "webp", { quality: 80 })
    .toBuffer()
}

// Write beside the file and rename over it, so a reader never sees half a file.
function replace(filename, data) {
  const path = `${DIR}/${filename}`
  writeFileSync(`${path}.tmp`, data)
  renameSync(`${path}.tmp`, path)
  console.log(`  replaced ${filename}`)
}

const { docs } = await (await fetch(PAYLOAD)).json()
const done = { replaced: 0, failed: 0 }

for (const doc of docs) {
  if (!WANTED[doc.id] || !doc.width || !doc.height) continue
  console.log(`#${doc.id} ${doc.filename} (alt: ${JSON.stringify(doc.alt)})`)
  try {
    const photo = await choose(doc.id)
    used.add(photo.id)
    const credit = `${photo.user?.name ?? "unknown"} on Unsplash`
    console.log(`  photo:    ${photo.links.html}  (${credit})`)
    if (DRY_RUN) continue
    // Unsplash's API terms ask for this call whenever a photo is downloaded.
    await fetchOk(photo.links.download_location, auth).catch(() => {})
    const url = `${photo.urls.raw}&w=${Math.max(doc.width, 1920)}&q=90&fm=jpg`
    const input = Buffer.from(await (await fetchOk(url)).arrayBuffer())
    const files = [
      [doc.filename, doc.width, doc.height],
      ...Object.values(doc.sizes ?? {})
        .filter((size) => size?.filename && size.width && size.height)
        .map((size) => [size.filename, size.width, size.height]),
    ]
    // Render everything first, so a failure leaves this item's files untouched.
    const rendered = []
    for (const [filename, width, height] of files) {
      rendered.push([filename, await render(input, filename, width, height, doc.focalX, doc.focalY)])
    }
    for (const [filename, data] of rendered) replace(filename, data)
    done.replaced++
  } catch (err) {
    console.log(`  FAILED, left as it was: ${err.message}`)
    done.failed++
  }
}

console.log(`Done: ${done.replaced} replaced, ${done.failed} failed, in ${DIR}`)
