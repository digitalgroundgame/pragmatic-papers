import { execSync } from "child_process"
import { readFileSync, writeFileSync } from "fs"
import { dirname, join } from "path"
import process from "process"
import * as readline from "readline"
import { fileURLToPath } from "url"
import { parseArgs } from "node:util"
import { blue, gray, green, red, yellow } from "./ansi.mjs"

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, "..")
const pkgPath = join(root, "package.json")

const { values, positionals } = parseArgs({
  args: process.argv.slice(2),
  options: {
    phase: { type: "string", default: "1" },
  },
  allowPositionals: true,
})
const version = positionals.find((a) => /^\d+\.\d+\.\d+$/.test(a))
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
const branch = `chore/${tag}`

try {
  execSync("gh --version", { stdio: "ignore" })
} catch {
  console.error(`${red("✖")} GitHub CLI (gh) is required. See: https://cli.github.com`)
  process.exit(1)
}

function run(cmd) {
  execSync(cmd, { cwd: root, stdio: "inherit" })
}

function capture(cmd) {
  return execSync(cmd, { cwd: root, encoding: "utf8", stdio: "pipe" }).trim()
}

function ask(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
    rl.question(question, (answer) => {
      rl.close()
      resolve(answer)
    })
  })
}

function prState(prUrl) {
  const match = prUrl.match(/github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)/)
  if (!match) throw new Error(`Cannot parse PR URL: ${prUrl}`)
  const [, owner, repo, number] = match
  return capture(
    `gh api repos/${owner}/${repo}/pulls/${number} --jq 'if .merged then "MERGED" else (.state | ascii_upcase) end'`,
  )
}

async function waitForMerge(prUrl) {
  while (true) {
    await ask(`${yellow("?")} Press Enter once the PR has been merged: `)
    const state = prState(prUrl)
    if (state === "MERGED") {
      console.warn(`${green("✔")} PR merged`)
      return
    }
    console.warn(`${red("✖")} PR state is "${state}" — not merged yet`)
  }
}

// ── Phase 1: Branch, version bump, PR → dev ────────────────────────────────────────────

if (phaseArg === 1) {
  console.warn(`\n${blue("●")} Phase 1: Creating release branch and PR to dev\n`)

  run(`git checkout dev`)
  run(`git pull origin dev`)
  run(`git checkout -b ${branch}`)

  const pkg = JSON.parse(readFileSync(pkgPath, "utf8"))
  const prev = pkg.version
  pkg.version = version
  writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n")
  console.warn(`${green("✔")} Bumped package.json: ${gray(prev)} → ${green(version)}`)

  run(`git add package.json`)
  run(`git commit -m "Chore: Bump package.json to ${tag}"`)
  run(`git push origin ${branch}`)

  const devPrUrl = capture(`gh pr create -f -B dev`)
  console.warn(`\n${green("✔")} PR to dev: ${devPrUrl}`)

  await waitForMerge(devPrUrl)
}

// ── Phase 2: PR dev → main ─────────────────────────────────────────────────────────────

if (phaseArg === 2) {
  console.warn(`\n${blue("●")} Phase 2: Creating PR dev → main\n`)

  run(`git checkout dev`)
  run(`git pull origin dev`)

  const mainPrUrl = capture(`gh pr create -f -B main`)
  console.warn(`\n${green("✔")} PR to main: ${mainPrUrl}`)

  await waitForMerge(mainPrUrl)
}

// ── Phase 3: Tag and release ───────────────────────────────────────────────────────────────────────

if (phaseArg === 3) {
  console.warn(`\n${blue("●")} Phase 3: Tagging and creating release\n`)

  run(`git checkout main`)
  run(`git pull origin main`)
  run(`git tag ${tag} -m "${tag}" -s`)
  run(`git push origin ${tag}`)

  const releaseUrl = capture(`gh release create ${tag} --target main -t "${tag}"`)
  console.warn(`\n${green("✔")} Release created: ${releaseUrl}`)
}
