import { existsSync, readFileSync, writeFileSync } from "node:fs"
import { execSync, spawn } from "node:child_process"
import { randomBytes } from "node:crypto"
import { resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { blue, green, red, yellow } from "./ansi.mjs"

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, "..")

const envPath = resolve(root, ".env")
const envExamplePath = resolve(root, ".env.example")
const envIgnorePath = resolve(root, ".gitignore")
const fontPlaceholder = resolve(root, "public/fonts/FKScreamer-Bold.woff2")

function randomHex() {
  return randomBytes(24).toString("hex")
}

function isPlaceholderFont() {
  if (!existsSync(fontPlaceholder)) return true
  return readFileSync(fontPlaceholder).byteLength === 0
}

// .env check
if (!existsSync(envPath)) {
  if (!existsSync(envExamplePath)) {
    console.error(`${red("✖")} No .env or .env.example found — cannot continue`)
    process.exit(1)
  }

  console.warn(`${blue("●")} No .env found — generating from .env.example...`)
  let content = readFileSync(envExamplePath, "utf8")
  content = content
    .replace(/PAYLOAD_SECRET=YOUR_SECRET_HERE/g, `PAYLOAD_SECRET=${randomHex()}`)
    .replace(/CRON_SECRET=YOUR_CRON_SECRET_HERE/g, `CRON_SECRET=${randomHex()}`)
    .replace(/PREVIEW_SECRET=YOUR_SECRET_HERE/g, `PREVIEW_SECRET=${randomHex()}`)
    .replace(/GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY=YOUR_SECRET_HERE/g, `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY=`)
    .replace(/NEXT_PUBLIC_GOOGLE_ANALYTICS_ID=YOUR_GA_ID_HERE/g, `NEXT_PUBLIC_GOOGLE_ANALYTICS_ID=`)
    .replace(/GH_FONT_READ=YOUR_SECRET_HERE/g, `GH_FONT_READ=`)
  writeFileSync(envPath, content)
  console.warn(`${green("✔")} .env created with generated secrets`)
  console.warn(`${yellow("⚠")} Review .env — some values need manual setup:\n`)
  console.warn(`    • GH_FONT_READ — required for custom fonts (run pnpm install again after setting)`)
  console.warn(`    • NEXT_PUBLIC_GOOGLE_ANALYTICS_ID — optional, for analytics`)
  console.warn(`    • GOOGLE_SERVICE_ACCOUNT_* — optional, for article recommendations\n`)

  // Ensure .env is gitignored
  if (existsSync(envIgnorePath)) {
    const gitignore = readFileSync(envIgnorePath, "utf8")
    if (!gitignore.includes(".env")) {
      writeFileSync(envIgnorePath, gitignore + "\n.env\n")
      console.warn(`${green("✔")} Added .env to .gitignore\n`)
    }
  }
} else {
  console.warn(`${green("✔")} .env found`)
}

// Warn about placeholder fonts
if (isPlaceholderFont()) {
  console.warn(`${yellow("⚠")} Custom fonts using placeholder — set GH_FONT_READ in .env and run pnpm install\n`)
}

// Start Postgres
console.warn(`${blue("●")} Starting Postgres...`)
execSync("docker compose -p pragmatic-papers -f docker-compose.yml up -d", {
  stdio: "pipe",
  cwd: root,
})
console.warn(`${green("✔")} Postgres running\n`)

// Start Next.js
console.warn(`${blue("●")} Starting Next.js (Turbopack) on http://localhost:8000\n`)

const nextEnv = { ...process.env, NODE_OPTIONS: "--no-deprecation", FORCE_COLOR: "1" }

const next = spawn(
  "node",
  ["node_modules/next/dist/bin/next", "dev", "-p", "8000", "--turbopack"],
  {
    cwd: root,
    stdio: "inherit",
    env: nextEnv,
  },
)

next.on("exit", (code) => process.exit(code ?? 0))