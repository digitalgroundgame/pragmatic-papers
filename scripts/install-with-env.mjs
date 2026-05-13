import { readFileSync } from "fs"
import { dirname, resolve } from "path"
import process from "process"
import { spawnSync } from "child_process"
import { fileURLToPath } from "url"
import { blue, green, red } from "./ansi.mjs"

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, "..")
const envPath = resolve(root, ".env")

const run = (command, args) => {
  const result = spawnSync(command, args, {
    cwd: root,
    env: process.env,
    stdio: "inherit",
  })

  if (result.error) {
    console.error(`${red("✗")} ${result.error.message}`)
    process.exit(1)
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1)
  }
}

const parseEnv = (contents) => {
  for (const line of contents.split(/\r?\n/)) {
    const trimmed = line.trim()

    if (!trimmed || trimmed.startsWith("#")) {
      continue
    }

    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/)

    if (!match) {
      continue
    }

    const [, key, rawValue] = match
    let value = rawValue.trim()

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }

    process.env[key] = value
  }
}

console.warn(`${blue("●")} Loading install environment...`)
run("node", [resolve(__dirname, "copy-env.mjs")])
parseEnv(readFileSync(envPath, "utf8"))
console.warn(`${green("✔")} Loaded .env`)

const pnpmCommand = process.platform === "win32" ? "pnpm.cmd" : "pnpm"

run(pnpmCommand, ["install", ...process.argv.slice(2)])
