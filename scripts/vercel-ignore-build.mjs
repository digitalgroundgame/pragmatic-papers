import { green, yellow } from "./ansi.mjs"

// Vercel "Ignored Build Step" script (vercel.json "ignoreCommand").
// Exit code 1 = proceed with the build, exit code 0 = skip the build.
// Docs: https://vercel.com/docs/project-configuration/git-settings#ignored-build-step

const ref = process.env.VERCEL_GIT_COMMIT_REF ?? ""
const prId = process.env.VERCEL_GIT_PULL_REQUEST_ID ?? ""

if (ref === "main") {
  console.warn(`${green("✔")} Commit is on "main" — proceeding with build.`)
  process.exit(1)
}

if (prId !== "") {
  console.warn(`${green("✔")} Commit belongs to PR #${prId} — proceeding with build.`)
  process.exit(1)
}

console.warn(
  `${yellow("●")} Skipping build: ref "${ref}" is not "main" and no pull request is open.`,
)
process.exit(0)
