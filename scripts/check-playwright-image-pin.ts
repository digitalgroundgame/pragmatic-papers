import { readFileSync } from "node:fs"
import { blue, green, red } from "./ansi.mjs"

// Every place that pins a Playwright Docker image tag — these must all
// resolve to the same version as the `@playwright/test` version pnpm
// actually installed, or CI/local baseline generation silently runs a
// different Chromium build than the one `pnpm test` uses.
export const PINNED_FILES = [
  "docker-compose.e2e.yml",
  ".github/workflows/playwright.yml",
  ".github/workflows/update-snapshots.yml",
]

const IMAGE_TAG_RE = /mcr\.microsoft\.com\/playwright:v(\d+\.\d+\.\d+)-([a-z]+)/g

export function getResolvedPlaywrightVersion(lockfileContents: string): string {
  // Matches the resolved version pnpm picked for the workspace root's
  // '@playwright/test' devDependency, e.g.:
  //   '@playwright/test':
  //     specifier: ^1.60.0
  //     version: 1.60.0
  const match = lockfileContents.match(
    /'@playwright\/test':\n\s+specifier: [^\n]+\n\s+version: (\d+\.\d+\.\d+)/,
  )
  if (!match?.[1]) {
    throw new Error("Could not find '@playwright/test' resolved version in pnpm-lock.yaml")
  }
  return match[1]
}

export interface PinnedTag {
  version: string
  codename: string
}

export function getPinnedTags(contents: string): PinnedTag[] {
  return [...contents.matchAll(IMAGE_TAG_RE)].map(([, version, codename]) => ({
    version: version!,
    codename: codename!,
  }))
}

export function checkPins(resolvedVersion: string, fileContents: Record<string, string>): string[] {
  const mismatches: string[] = []
  const codenames = new Set<string>()

  for (const [file, contents] of Object.entries(fileContents)) {
    const tags = getPinnedTags(contents)
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

  return mismatches
}

export function main(): void {
  const resolvedVersion = getResolvedPlaywrightVersion(readFileSync("pnpm-lock.yaml", "utf-8"))
  console.warn(`${blue("●")} Resolved @playwright/test version: ${resolvedVersion}`)

  const fileContents = Object.fromEntries(
    PINNED_FILES.map((file) => [file, readFileSync(file, "utf-8")]),
  )
  const mismatches = checkPins(resolvedVersion, fileContents)

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
}

// CLI entry point — only runs when executed directly, not when imported.
/* v8 ignore next 3 */
if (process.argv[1] === import.meta.filename) {
  main()
}
