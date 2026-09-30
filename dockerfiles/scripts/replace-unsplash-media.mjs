// Replaces the placeholder files behind staging's Unsplash media with the real photos,
// under the exact filenames the database lists: the original and every size.
// Run inside the staging container, as its own user:
//   docker exec -i -e UNSPLASH_ACCESS_KEY=... <container> node --input-type=module - < replace-unsplash-media.mjs
// or, with photos you downloaded yourself into a folder the container can read,
// each named by its Unsplash id (QLrzbl-B3no.jpg):
//   docker exec -i -e SOURCE_DIR=/tmp/unsplash <container> node --input-type=module - < replace-unsplash-media.mjs
// Only media whose filename carries an Unsplash id is touched. DRY_RUN=1 lists what it would do.
import { createRequire } from "node:module"
import { readdirSync, readFileSync, renameSync, writeFileSync } from "node:fs"

const require = createRequire("/app/")
const sharp = require("sharp")
const DIR = "/app/public/media"
const API = `http://127.0.0.1:${process.env.PORT || 3000}/api/media?limit=500&depth=0`
const { UNSPLASH_ACCESS_KEY: KEY, SOURCE_DIR, DRY_RUN } = process.env
const FORMATS = { jpg: "jpeg", jpeg: "jpeg", png: "png", webp: "webp", avif: "avif" }

if (!KEY && !SOURCE_DIR) {
  console.error("Set UNSPLASH_ACCESS_KEY or SOURCE_DIR (see the top of this file).")
  process.exit(1)
}

async function fetchOk(url, headers = {}) {
  const res = await fetch(url, { headers, signal: AbortSignal.timeout(60_000) })
  if (!res.ok) throw new Error(`${res.status} from ${url.split("?")[0]}`)
  return res
}

async function source(id, width) {
  if (SOURCE_DIR) {
    const file = readdirSync(SOURCE_DIR).find((name) => name.replace(/\.[^.]+$/, "") === id)
    if (file) return readFileSync(`${SOURCE_DIR}/${file}`)
    if (!KEY) throw new Error(`no ${id}.* in ${SOURCE_DIR}`)
  }
  const auth = { Authorization: `Client-ID ${KEY}`, "Accept-Version": "v1" }
  const photo = await (await fetchOk(`https://api.unsplash.com/photos/${id}`, auth)).json()
  // Unsplash's API terms ask for this call whenever a photo is downloaded.
  await fetchOk(photo.links.download_location, auth).catch(() => {})
  // No larger than the stored original, which is all any size is cut from.
  const url = `${photo.urls.raw}&w=${width}&q=90&fm=jpg`
  return Buffer.from(await (await fetchOk(url)).arrayBuffer())
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

const { docs } = await (await fetch(API)).json()
const done = { replaced: 0, failed: 0 }

for (const doc of docs) {
  const id = doc.filename?.match(/-([A-Za-z0-9_-]{11})-unsplash/)?.[1]
  if (!id || !doc.width || !doc.height) continue
  console.log(`#${doc.id} ${doc.filename} (unsplash.com/photos/${id})`)
  if (DRY_RUN) continue
  try {
    const input = await source(id, doc.width)
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

console.log(`Done: ${done.replaced} photos replaced, ${done.failed} failed, in ${DIR}`)
