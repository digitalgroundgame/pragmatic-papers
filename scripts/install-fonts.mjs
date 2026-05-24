import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "fs"
import { dirname, resolve } from "path"
import process from "process"
import { fileURLToPath } from "url"
import { blue, gray, green, yellow } from "./ansi.mjs"

const __dirname = dirname(fileURLToPath(import.meta.url))

const src = resolve(
  __dirname,
  "../node_modules/@digitalgroundgame/fonts/assets/FKScreamer-2.0.3/woff2-static",
)
const dest = resolve(__dirname, "../public/fonts")
const placeholder = resolve(dest, "FKScreamer-Bold.woff2")
const blankFont = resolve(__dirname, "AdobeBlank.woff2")

console.warn(`${blue("●")} Installing fonts...`)
mkdirSync(dest, { recursive: true })

if (existsSync(src)) {
  cpSync(src, dest, { recursive: true })
  console.warn(`${green("✔")} Fonts copied to public/fonts`)
  process.exit(0)
}

if (existsSync(placeholder)) {
  const currentFont = readFileSync(placeholder)
  const isAdobeBlank = currentFont.equals(readFileSync(blankFont))
  const isOldPlaceholder = currentFont.byteLength < 1000 && !isAdobeBlank

  if (isAdobeBlank) {
    console.warn(gray("○ Fonts already installed (placeholder)"))
    process.exit(0)
  }

  if (isOldPlaceholder) {
    writeFileSync(placeholder, readFileSync(blankFont))
    console.warn(`${green("✔")} Updated placeholder font file`)
    process.exit(0)
  }

  console.warn(gray("○ Fonts already installed (real)"))
  process.exit(0)
}

console.warn(`${yellow("⚠")} @digitalgroundgame/fonts not found`)
writeFileSync(placeholder, readFileSync(blankFont))
console.warn(`${green("✔")} Using placeholder font file`)
process.exit(0)
