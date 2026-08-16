// Release helper. Three phases:
//   1) branch off dev, bump package.json, open PR → dev   (CI runs)
//   2) open PR dev → main and land it as a MERGE COMMIT    (keeps branches in sync)
//   3) tag main and create the GitHub release
// Phase 2's merge is auto-enabled as a merge commit so dev and main never diverge.
// --phase is a STARTING point and the run chains forward: the default `--phase 1`
// carries through phase 2 once you confirm the dev PR merged. Phase 3 is separate —
// release.yml tags automatically on the version bump, so chaining into it would race
// the workflow; pass `--phase 3` to tag/release by hand instead.
// Phase 1 is resumable: if a run dies partway (signing passphrase, hook, network),
// re-running reuses the branch, bump commit, and PR it already made.

import { readFileSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { parseArgs } from "node:util"
import { fileURLToPath } from "node:url"

import { blue, gray, green, red } from "./ansi.mjs"
import {
  autoMergeAndWait,
  bumpMessage,
  capture,
  commitIfStaged,
  createOrReusePr,
  findVersion,
  prepareBranch,
  requireGh,
  run,
  waitForMerge,
} from "./release-lib"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const pkgPath = join(root, "package.json")

/** Release branch that carries the version bump into dev. */
export const releaseBranch = (version: string): string => `chore/v${version}`

export async function main(): Promise<void> {
  const { values, positionals } = parseArgs({
    args: process.argv.slice(2),
    options: { phase: { type: "string", default: "1" } },
    allowPositionals: true,
  })
  const version = findVersion(positionals)
  const phaseArg = parseInt(values.phase, 10)

  if (!version) {
    console.error(`${red("✖")} Usage: pnpm release <version> [--phase <1|2|3>]`)
    console.error(`${red("✖")} Example: pnpm release 2.2.0`)
    console.error(`${red("✖")} Example: pnpm release 2.2.0 --phase 2`)
    process.exit(1)
  }

  if (![1, 2, 3].includes(phaseArg)) {
    console.error(`${red("✖")} --phase must be 1, 2, or 3`)
    process.exit(1)
  }

  const tag = `v${version}`
  const branch = releaseBranch(version)

  requireGh()

  // ── Phase 1: Branch, version bump, PR → dev ──────────────────────────────
  if (phaseArg <= 1) {
    console.warn(`\n${blue("●")} Phase 1: Creating release branch and PR to dev\n`)

    run(`git checkout dev`)
    run(`git pull origin dev`)
    prepareBranch(branch, "dev", tag)

    const pkg = JSON.parse(readFileSync(pkgPath, "utf8"))
    const prev = pkg.version
    if (prev === version) {
      console.warn(`${green("✔")} package.json already at ${green(version)}`)
    } else {
      pkg.version = version
      writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n")
      console.warn(`${green("✔")} Bumped package.json: ${gray(prev)} → ${green(version)}`)
    }

    run(`git add package.json`)
    commitIfStaged(bumpMessage(tag))
    run(`git push origin ${branch}`)

    const devPrUrl = createOrReusePr(branch, "dev")
    console.warn(`\n${green("✔")} PR to dev: ${devPrUrl}`)

    await waitForMerge(devPrUrl)
  }

  // ── Phase 2: PR dev → main (merge commit) ────────────────────────────────
  if (phaseArg <= 2) {
    console.warn(`\n${blue("●")} Phase 2: Creating PR dev → main\n`)

    run(`git checkout dev`)
    run(`git pull origin dev`)

    const mainPrUrl = createOrReusePr("dev", "main")
    console.warn(`\n${green("✔")} PR to main: ${mainPrUrl}`)

    await autoMergeAndWait(mainPrUrl)
  }

  // ── Phase 3: Tag and release ─────────────────────────────────────────────
  if (phaseArg === 3) {
    console.warn(`\n${blue("●")} Phase 3: Tagging and creating release\n`)

    run(`git checkout main`)
    run(`git pull origin main`)
    run(`git tag ${tag} -m "${tag}" -s`)
    run(`git push origin ${tag}`)

    const releaseUrl = capture(`gh release create ${tag} --target main -t "${tag}"`)
    console.warn(`\n${green("✔")} Release created: ${releaseUrl}`)
  }
}

/* v8 ignore next 3 */
if (process.argv[1] === import.meta.filename) {
  await main()
}
