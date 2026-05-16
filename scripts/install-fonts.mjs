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

console.warn(`${blue("●")} Installing fonts...`)
mkdirSync(dest, { recursive: true })

if (existsSync(src)) {
  cpSync(src, dest, { recursive: true })
  console.warn(`${green("✔")} Fonts copied to public/fonts`)
  process.exit(0)
}

if (existsSync(placeholder) && readFileSync(placeholder).byteLength !== 0) {
  console.warn(gray("○ Fonts already installed"))
  process.exit(0)
}

console.warn(`${yellow("⚠")} @digitalgroundgame/fonts not found`)
// Write minimal valid woff2 so Turbopack doesn't choke on an empty file
const header = Buffer.alloc(48)
header.writeUInt32BE(0x774F4632, 0)  // signature "wOF2"
header.writeUInt32BE(0x00010000, 4)  // sfVersion
header.writeUInt32BE(48, 8)           // total length
writeFileSync(placeholder, header)
console.warn(`${green("✔")} Using placeholder font file`)
process.exit(0)
