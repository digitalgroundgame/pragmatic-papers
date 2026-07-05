import { readFileSync } from "node:fs"
import { blue, green, red } from "./ansi.mjs"

// Every place that pins a Playwright Docker image tag — these must all
// resolve to the same version as the `@playwright/test` version pnpm
// actually installed, or CI/local baseline generation silently runs a
// different Chromium build than the one `pnpm test` uses.
const PINNED_FILES = [
  "docker-compose.e2e.yml",
  ".github/workflows/playwright.yml",
  ".github/workflows/update-snapshots.yml",
]

const IMAGE_TAG_RE = /mcr\.microsoft\.com\/playwright:v(\d+\.\d+\.\d+)-([a-z]+)/g

function getResolvedPlaywrightVersion() {
  const lockfile = readFileSync("pnpm-lock.yaml", "utf-8")
  // Matches the resolved version pnpm picked for the workspace root's
  // '@playwright/test' devDependency, e.g.:
  //   '@playwright/test':
  //     specifier: ^1.60.0
  //     version: 1.60.0
  const match = lockfile.match(/'@playwright\/test':\n\s+specifier: [^\n]+\n\s+version: (\d+\.\d+\.\d+)/)
  if (!match) {
    throw new Error("Could not find '@playwright/test' resolved version in pnpm-lock.yaml")
  }
  return match[1]
}

function getPinnedTags(file) {
  const contents = readFileSync(file, "utf-8")
  return [...contents.matchAll(IMAGE_TAG_RE)].map(([, version, codename]) => ({ version, codename }))
}

const resolvedVersion = getResolvedPlaywrightVersion()
console.warn(`${blue("●")} Resolved @playwright/test version: ${resolvedVersion}`)

const mismatches = []
const codenames = new Set()

for (const file of PINNED_FILES) {
  const tags = getPinnedTags(file)
  if (tags.length === 0) {
    mismatches.push(`${file}: no mcr.microsoft.com/playwright image tag found`)
    continue
  }
  for (const { version, codename } of tags) {
    codenames.add(codename)
    if (version !== resolvedVersion) {
      mismatches.push(
        `${file}: pinned to v${version}-${codename}, but pnpm-lock.yaml resolves @playwright/test to ${resolvedVersion}`,
      )
    }
  }
}

if (codenames.size > 1) {
  mismatches.push(
    `Inconsistent Ubuntu codenames pinned across files: ${[...codenames].join(", ")} — use the same base image everywhere.`,
  )
}

if (mismatches.length > 0) {
  console.error(`${red("✖")} Playwright Docker image pin is out of sync:`)
  for (const mismatch of mismatches) {
    console.error(`  - ${mismatch}`)
  }
  console.error(
    `\nUpdate the image tag in ${PINNED_FILES.join(", ")} to match v${resolvedVersion} ` +
      `(mcr.microsoft.com/playwright:v${resolvedVersion}-<codename>), then regenerate ` +
      `baselines with 'pnpm test:e2e:update-snapshots -- --update-snapshots=all'.`,
  )
  process.exit(1)
}

console.warn(`${green("✔")} Playwright Docker image pin matches pnpm-lock.yaml in all files.`)
