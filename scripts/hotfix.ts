// Hotfix helper — the production-fix counterpart of scripts/release.ts. Two phases:
//   1) branch off main, bump package.json, open PR → main  (CI runs; review & merge)
//   2) back-merge main → dev and land it as a MERGE COMMIT  (keeps branches in sync)
// The tag + GitHub release are produced automatically by .github/workflows/release.yml
// when the version bump lands on main, so there is no manual tag/release phase here.
// --phase is a STARTING point and the run chains forward: the default `--phase 1`
// carries through phase 2 once you confirm the main PR merged.

import { readFileSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { parseArgs } from "node:util"
import { fileURLToPath } from "node:url"

import { blue, gray, green, red } from "./ansi.mjs"
import { autoMergeAndWait, capture, findVersion, requireGh, run, waitForMerge } from "./release-lib"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const pkgPath = join(root, "package.json")

/** Branch that carries the fix + version bump onto main. */
export const hotfixBranch = (version: string): string => `hotfix/v${version}`

/** Branch that back-merges main into dev after the hotfix ships. */
export const backmergeBranch = (version: string): string => `chore/back-merge-v${version}`

export async function main(): Promise<void> {
  const { values, positionals } = parseArgs({
    args: process.argv.slice(2),
    options: { phase: { type: "string", default: "1" } },
    allowPositionals: true,
  })
  const version = findVersion(positionals)
  const phaseArg = parseInt(values.phase, 10)

  if (!version) {
    console.error(`${red("✖")} Usage: pnpm hotfix <version> [--phase <1|2>]`)
    console.error(`${red("✖")} Example: pnpm hotfix 1.0.1`)
    console.error(`${red("✖")} Example: pnpm hotfix 1.0.1 --phase 2`)
    process.exit(1)
  }

  if (![1, 2].includes(phaseArg)) {
    console.error(`${red("✖")} --phase must be 1 or 2`)
    process.exit(1)
  }

  const tag = `v${version}`

  requireGh()

  // ── Phase 1: Branch off main, bump, PR → main ────────────────────────────
  if (phaseArg <= 1) {
    console.warn(`\n${blue("●")} Phase 1: Creating hotfix branch and PR to main\n`)

    run(`git checkout main`)
    run(`git pull origin main`)
    run(`git checkout -b ${hotfixBranch(version)}`)

    const pkg = JSON.parse(readFileSync(pkgPath, "utf8"))
    const prev = pkg.version
    pkg.version = version
    writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n")
    console.warn(`${green("✔")} Bumped package.json: ${gray(prev)} → ${green(version)}`)

    run(`git add package.json`)
    run(`git commit -m "Bump package.json to ${tag}"`)
    run(`git push origin ${hotfixBranch(version)}`)

    const mainPrUrl = capture(`gh pr create -f -B main`)
    console.warn(`\n${green("✔")} PR to main: ${mainPrUrl}`)
    console.warn(`${gray("  On merge, the Release workflow tags and releases ")}${tag}.`)

    await waitForMerge(mainPrUrl)
  }

  // ── Phase 2: Back-merge main → dev (merge commit) ────────────────────────
  if (phaseArg <= 2) {
    console.warn(`\n${blue("●")} Phase 2: Back-merging main → dev\n`)

    run(`git checkout main`)
    run(`git pull origin main`)
    run(`git checkout -b ${backmergeBranch(version)}`)
    run(`git push origin ${backmergeBranch(version)}`)

    const devPrUrl = capture(`gh pr create -f -B dev`)
    console.warn(`\n${green("✔")} Back-merge PR to dev: ${devPrUrl}`)

    await autoMergeAndWait(devPrUrl)
  }
}

if (process.argv[1] === import.meta.filename) {
  await main()
}
