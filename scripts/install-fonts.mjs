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

const envExample = resolve(__dirname, "../.env.example")
const envFile = resolve(__dirname, "../.env")
const npmrcFile = resolve(__dirname, "../.npmrc")

if (!existsSync(envFile) && existsSync(envExample)) {
  cpSync(envExample, envFile)
  console.warn(`${green("✔")} Created .env from .env.example`)
}

if (!existsSync(npmrcFile)) {
  writeFileSync(
    npmrcFile,
    [
      "legacy-peer-deps=true",
      "enable-pre-post-scripts=true",
      "@digitalgroundgame:registry=https://npm.pkg.github.com",
      "//npm.pkg.github.com/:_authToken=ghp_REPLACE_WITH_YOUR_TOKEN",
    ].join("\n") + "\n",
  )
  console.warn(`${yellow("⚠")} Created .npmrc with a placeholder GitHub token`)
  console.warn(
    `${yellow("⚠")} Edit .npmrc and replace the auth token with your GitHub personal access token (needs read:packages scope)`,
  )
  console.warn(
    `   ${gray("→")} Create one at https://github.com/settings/tokens`,
  )
}

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
writeFileSync(placeholder, "")
console.warn(`${green("✔")} Using placeholder font file`)
process.exit(0)
