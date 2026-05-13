import { copyFileSync, existsSync } from "fs"
import { dirname, resolve } from "path"
import process from "process"
import { fileURLToPath } from "url"
import { blue, gray, green, red } from "./ansi.mjs"

const __dirname = dirname(fileURLToPath(import.meta.url))
const env = resolve(__dirname, "../.env")
const example = resolve(__dirname, "../.env.example")

console.warn(`${blue("●")} Setting up environment...`)

if (!existsSync(env)) {
  if (!existsSync(example)) {
    console.warn(`${red("✗")} No .env.example found`)
    process.exit(0)
  }

  copyFileSync(example, env)
  console.warn(`${green("✔")} Copied .env.example → .env`)
} else {
  console.warn(gray("○ .env already exists"))
}
