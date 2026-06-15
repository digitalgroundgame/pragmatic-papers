import { cpSync, existsSync, mkdirSync, readFileSync } from "fs"
import { dirname, resolve } from "path"
import process from "process"
import { fileURLToPath } from "url"
import { blue, gray, green, yellow } from "./ansi.mjs"

const __dirname = dirname(fileURLToPath(import.meta.url))

const fallbackFont = resolve(__dirname, "Inter-Bold.woff2")

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

// Inter-Bold.woff2 fallback is ~74KB; anything under 1000 bytes is a stale empty placeholder
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

cpSync(fallbackFont, fontPath)
console.warn(`${green("✔")} Copied Inter Bold as fallback font`)
process.exit(0)
