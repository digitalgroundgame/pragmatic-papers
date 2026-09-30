// Recreates the files behind staging's media rows, under the exact filenames the
// database lists. Run inside the staging container, as its own user:
//   docker exec -i <container> node --input-type=module - < restore-staging-media.mjs
// Unsplash and Wallhaven originals are downloaded by the id in their filename;
// anything else becomes a labelled placeholder at the recorded size. Existing
// files are never overwritten.
import { createRequire } from "node:module"
import { existsSync, writeFileSync } from "node:fs"

const require = createRequire("/app/")
const sharp = require("sharp")
const DIR = "/app/public/media"
const API = `http://127.0.0.1:${process.env.PORT || 3000}/api/media?limit=500&depth=0`

async function download(url) {
  const res = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(60_000) })
  if (!res.ok) throw new Error(`${res.status} from ${url}`)
  return Buffer.from(await res.arrayBuffer())
}

async function original(filename) {
  const unsplash = filename.match(/-([A-Za-z0-9_-]{11})-unsplash/)
  if (unsplash) return download(`https://unsplash.com/photos/${unsplash[1]}/download?force=true`)
  const wallhaven = filename.match(/wallhaven-([a-z0-9]{6})/)
  if (wallhaven) {
    const id = wallhaven[1]
    for (const ext of ["jpg", "png"]) {
      try {
        return await download(`https://w.wallhaven.cc/full/${id.slice(0, 2)}/wallhaven-${id}.${ext}`)
      } catch {}
    }
  }
  return null
}

function placeholderSvg(width, height, label) {
  const size = Math.max(16, Math.round(Math.min(width, height) / 14))
  const text = label.replace(/[<>&"]/g, "")
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">` +
      `<rect width="100%" height="100%" fill="#1f2a44"/>` +
      `<text x="50%" y="50%" fill="#c9d1e3" font-family="sans-serif" font-size="${size}" ` +
      `text-anchor="middle" dominant-baseline="middle">${text}</text></svg>`,
  )
}

// Silent MPEG-1 Layer III, 128 kb/s, 44.1 kHz: a header and zeroed frame decode to silence.
function silentMp3(seconds) {
  const frame = Buffer.alloc(417)
  frame.set([0xff, 0xfb, 0x90, 0x64])
  const frames = Math.max(1, Math.ceil((seconds * 44100) / 1152))
  return Buffer.concat(Array.from({ length: frames }, () => frame))
}

const FORMATS = { jpg: "jpeg", jpeg: "jpeg", png: "png", webp: "webp", avif: "avif" }

// Cover-crop to the recorded size around the focal point, as the stored variants were.
async function render(source, filename, width, height, focalX, focalY) {
  const meta = await sharp(source).metadata()
  const scale = Math.max(width / meta.width, height / meta.height)
  const w = Math.max(width, Math.round(meta.width * scale))
  const h = Math.max(height, Math.round(meta.height * scale))
  const left = Math.min(w - width, Math.max(0, Math.round((w * (focalX ?? 50)) / 100 - width / 2)))
  const top = Math.min(h - height, Math.max(0, Math.round((h * (focalY ?? 50)) / 100 - height / 2)))
  return sharp(source)
    .rotate()
    .resize(w, h)
    .extract({ left, top, width, height })
    .toFormat(FORMATS[filename.split(".").pop().toLowerCase()] ?? "webp", { quality: 80 })
    .toBuffer()
}

function write(filename, data) {
  const path = `${DIR}/${filename}`
  if (existsSync(path)) return console.log(`  kept     ${filename}`)
  writeFileSync(path, data)
  console.log(`  wrote    ${filename}`)
}

const { docs } = await (await fetch(API)).json()
const summary = { downloaded: 0, placeholder: 0 }

for (const doc of docs) {
  console.log(`#${doc.id} ${doc.filename}`)
  try {
    if (doc.mimeType?.startsWith("audio/")) {
      write(doc.filename, silentMp3(doc.duration || 3))
      summary.placeholder++
      continue
    }
    if (doc.mimeType === "image/svg+xml") {
      write(doc.filename, placeholderSvg(doc.width || 800, doc.height || 800, doc.filename))
      summary.placeholder++
      continue
    }
    if (!doc.mimeType?.startsWith("image/") || !doc.width || !doc.height) {
      console.log("  skipped: not an image with recorded dimensions")
      continue
    }

    let source = null
    try {
      source = await original(doc.filename)
    } catch (err) {
      console.log(`  download failed (${err.message}), using a placeholder`)
    }
    if (source) summary.downloaded++
    else {
      source = await sharp(placeholderSvg(doc.width, doc.height, doc.filename)).png().toBuffer()
      summary.placeholder++
    }

    write(doc.filename, await render(source, doc.filename, doc.width, doc.height, doc.focalX, doc.focalY))
    for (const size of Object.values(doc.sizes ?? {})) {
      if (!size?.filename || !size.width || !size.height) continue
      write(size.filename, await render(source, size.filename, size.width, size.height, doc.focalX, doc.focalY))
    }
  } catch (err) {
    console.log(`  FAILED: ${err.message}`)
  }
}

console.log(
  `Done: ${summary.downloaded} downloaded, ${summary.placeholder} placeholders, in ${DIR}`,
)
