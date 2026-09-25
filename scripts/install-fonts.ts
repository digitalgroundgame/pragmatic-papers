import { cpSync, existsSync, mkdirSync, readFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import process from "node:process"
import { fileURLToPath } from "node:url"
import { blue, gray, green, red, yellow } from "./ansi.mjs"

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = process.cwd()

const fallbackFont = resolve(__dirname, "Inter-Bold.woff2")

/**
 * Deploy builds must ship the real FKScreamer. The Inter fallback keeps `pnpm install`
 * working for contributors without access to the private package, but on a deploy it
 * silently renders the wrong typeface behind a green build — so fail loudly instead.
 * Set by dockerfiles/PragmaticPapers.Dockerfile (Coolify) and the snapshot workflow.
 */
const fontsRequired = process.env.FONTS_REQUIRED === "true"

const src = resolve(
  root,
  "node_modules/@digitalgroundgame/fonts/assets/FKScreamer-2.0.3/woff2-static",
)
const dest = resolve(root, "public/fonts")
const fontPath = resolve(dest, "FKScreamer-Bold.woff2")

console.warn(`${blue("●")} Installing fonts...`)
mkdirSync(dest, { recursive: true })

if (existsSync(src)) {
  cpSync(src, dest, { recursive: true })
  console.warn(`${green("✔")} Fonts copied to public/fonts`)
  process.exit(0)
}

// Inter-Bold.woff2 fallback is ~24KB; anything under 1000 bytes is a stale empty placeholder.
// A previous run's fallback also clears that bar, so compare bytes rather than trusting the
// size alone — otherwise a stale Inter reports itself as "real" and skips the check below.
if (existsSync(fontPath) && readFileSync(fontPath).byteLength > 1000) {
  if (!readFileSync(fontPath).equals(readFileSync(fallbackFont))) {
    console.warn(gray("○ Fonts already installed (real)"))
    process.exit(0)
  }
  console.warn(gray("○ Installed font is the Inter fallback from an earlier run"))
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

// A deploy that degrades to Inter ships the wrong typeface with a green build — the
// exact failure mode that put the fallback on a preview deployment unnoticed. Stop here
// so the build fails at install time instead of at somebody's eyeballs.
if (fontsRequired) {
  console.error(`${red("✖")} FONTS_REQUIRED is set — refusing to fall back to Inter.`)
  console.error(
    gray(
      `  This build must ship FKScreamer. Check GH_FONT_READ: a GitHub PAT with
  read:packages scope that has not expired, exposed to the build (not just runtime).
  Note the pnpm store is cached, so rebuild WITHOUT cache after rotating the token,
  or the store will still be missing @digitalgroundgame/fonts.`,
    ),
  )
  process.exit(1)
}

cpSync(fallbackFont, fontPath)
console.warn(`${green("✔")} Copied Inter Bold as fallback font`)
process.exit(0)
