import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "fs"
import { dirname, resolve } from "path"
import process from "process"
import { fileURLToPath } from "url"
import { blue, gray, green, yellow } from "./ansi.mjs"

const __dirname = dirname(fileURLToPath(import.meta.url))

const FALLBACK_FONT_FAMILY = "Inter"
const FALLBACK_FONT_WEIGHT = "700"

const src = resolve(
  __dirname,
  "../node_modules/@digitalgroundgame/fonts/assets/FKScreamer-2.0.3/woff2-static",
)
const dest = resolve(__dirname, "../public/fonts")
const fontPath = resolve(dest, "FKScreamer-Bold.woff2")

console.warn(`${blue("●")} Installing fonts...`)
mkdirSync(dest, { recursive: true })

if (existsSync(src)) {
  cpSync(src, dest, { recursive: true })
  console.warn(`${green("✔")} Fonts copied to public/fonts`)
  process.exit(0)
}

if (existsSync(fontPath) && readFileSync(fontPath).byteLength > 1000) {
  console.warn(gray("○ Fonts already installed (real)"))
  process.exit(0)
}

console.warn(`${yellow("⚠")} Optional dependency @digitalgroundgame/fonts is not installed.`)
if (!process.env.GH_FONT_READ) {
  console.warn(
    gray(
      `  Reason: The GH_FONT_READ environment variable is not set.
  This token is required to authenticate with the GitHub Packages registry
  to install the private @digitalgroundgame/fonts package.
  To resolve this, set GH_FONT_READ to a valid GitHub Personal Access Token (PAT)
  with read:packages scope, and then run 'pnpm reinstall'.`,
    ),
  )
} else {
  console.warn(
    gray(
      `  Reason: GH_FONT_READ is set, but the package was not found.
  This can happen if the token is invalid/expired, or if optional dependencies
  were skipped. Run 'pnpm reinstall' to force a fresh install and verify the token.`,
    ),
  )
}

const FALLBACK_FONT_URL = `https://fonts.googleapis.com/css2?family=${FALLBACK_FONT_FAMILY}:wght@${FALLBACK_FONT_WEIGHT}&display=swap`

let downloaded = false

try {
  console.warn(gray(`  -> Downloading ${FALLBACK_FONT_FAMILY} as fallback...`))
  const cssResp = await fetch(FALLBACK_FONT_URL, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    },
  })
  const css = await cssResp.text()

  const latinMatch = css.match(
    /url\(([^)]+)\) format\('woff2'\)[^}]*unicode-range:\s*U\+0000-00FF/,
  )
  const url = latinMatch?.[1]

  if (url) {
    console.warn(gray(`  -> Fetching woff2 from Google Fonts CDN...`))
    const fontResp = await fetch(url)
    if (fontResp.ok) {
      const buffer = Buffer.from(await fontResp.arrayBuffer())
      writeFileSync(fontPath, buffer)
      console.warn(`${green("✔")} Downloaded ${FALLBACK_FONT_FAMILY} Bold as fallback font (${(buffer.byteLength / 1024).toFixed(1)} KB)`)
      downloaded = true
    }
  }
} catch (err) {
  console.warn(gray(`  -> Download failed: ${err.message}`))
}

if (!downloaded) {
  console.warn(`${yellow("⚠")} Could not download fallback font.`)
  console.warn(
    gray(
      `  To use the real fonts, set GH_FONT_READ to a valid GitHub PAT and run 'pnpm reinstall'.
  Otherwise, ensure network access to download the fallback font.`,
    ),
  )
}

process.exit(0)
