import { execSync } from "child_process"
import { readdirSync, rmSync } from "fs"
import { dirname, join } from "path"
import process from "process"
import { fileURLToPath } from "url"
import { blue, green, red } from "./ansi.mjs"

const __dirname = dirname(fileURLToPath(import.meta.url))
const migrationsDir = join(__dirname, "../src/migrations")

// The newest migration: files are named by timestamp.
const fullName = readdirSync(migrationsDir)
  .filter((file) => /^\d{8}_\d{6}_.+\.ts$/.test(file))
  .sort()
  .at(-1)
  ?.slice(0, -".ts".length)
if (!fullName) {
  console.error(`${red("✖")} No migrations found in src/migrations`)
  process.exit(1)
}

// Delete the .ts and .json migration files
for (const file of [`${fullName}.ts`, `${fullName}.json`]) {
  rmSync(join(migrationsDir, file))
  console.warn(`${green("✔")} Deleted: ${file}`)
}

// payload.config.ts imports index.ts, so it must stop importing the deleted file
// before `migrate:create` loads the config.
execSync("pnpm migrate:index", { cwd: join(__dirname, ".."), stdio: "inherit" })

// Strip the timestamp prefix (YYYYMMDD_HHMMSS_) to get just the descriptive name
const migrationName = fullName.replace(/^\d{8}_\d{6}_/, "")

console.warn(`${blue("●")} Running: pnpm migrate:create "${migrationName}"`)
execSync(`pnpm migrate:create "${migrationName}"`, {
  cwd: join(__dirname, ".."),
  stdio: "inherit",
})
