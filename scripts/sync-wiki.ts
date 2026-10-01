/**
 * Publishes the repo's `wiki/` folder to the GitHub wiki, run by
 * .github/workflows/wiki-sync.yml under plain Node 24 (no install needed):
 *
 *   node scripts/sync-wiki.ts <wiki-clone-dir>
 *
 * The wiki is a separate git repository that cloud sessions can't push to, so
 * its pages live in `wiki/` here and go through PRs like any other file. On a
 * push to dev that changes them, this mirrors `wiki/` into a clone of the wiki
 * and pushes one commit, whose message names the repo commit it came from.
 *
 * A page edited on the wiki directly would be overwritten, so a run refuses
 * when the wiki's newest commit isn't one of these syncs. Copy that edit into
 * `wiki/` in a PR, or run the workflow by hand with `force` to discard it.
 * The very first sync (no sync commit in the wiki's history yet) imports
 * nothing and overwrites whatever is there, since `wiki/` was copied from it.
 *
 * DRY_RUN=true reports what would change and writes nothing.
 */
import { execFileSync } from "node:child_process"
import { copyFileSync, mkdirSync, readdirSync, rmSync } from "node:fs"
import { dirname, join, relative } from "node:path"
import { pathToFileURL } from "node:url"

/** Marks the wiki commits this script makes; followed by `<owner/repo>@<sha>`. */
export const MARKER = "Synced from "

export const syncMessage = (repo: string, sha: string): string =>
  `docs: sync from ${repo}@${sha.slice(0, 7)}\n\n${MARKER}${repo}@${sha}`

export interface WikiState {
  /** The full message of the wiki's newest commit. */
  headMessage: string
  /** A one-line description of that commit, for the error message. */
  headSummary: string
  /** Whether any commit in the wiki's history is a sync. */
  everSynced: boolean
}

/** Why this run must not overwrite the wiki, or undefined when it may. */
export function refusal(state: WikiState, force: boolean): string | undefined {
  if (force || !state.everSynced || state.headMessage.includes(MARKER)) return undefined
  return [
    `The wiki was edited directly since the last sync (${state.headSummary}).`,
    "Copy that change into wiki/ in a PR so it isn't lost, or run the Wiki sync workflow by hand with force to overwrite it.",
  ].join(" ")
}

/** Every file under `dir`, as paths relative to it, skipping `.git`. */
export function listFiles(dir: string): string[] {
  const out: string[] = []
  const walk = (current: string) => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      if (entry.name === ".git") continue
      const path = join(current, entry.name)
      if (entry.isDirectory()) walk(path)
      else out.push(relative(dir, path))
    }
  }
  walk(dir)
  return out.sort()
}

/** Make `target` hold exactly the files in `source`, leaving `.git` alone. */
export function mirror(source: string, target: string): void {
  const keep = new Set(listFiles(source))
  for (const file of listFiles(target)) if (!keep.has(file)) rmSync(join(target, file))
  for (const file of keep) {
    mkdirSync(dirname(join(target, file)), { recursive: true })
    copyFileSync(join(source, file), join(target, file))
  }
}

/** The workflow's env (GITHUB_REPOSITORY, GITHUB_SHA, FORCE, DRY_RUN); not NodeJS.ProcessEnv, which the app's typings narrow. */
export type Env = Record<string, string | undefined>

export function main(
  wikiDir: string,
  env: Env,
  log: (message: string) => void,
  git = (args: string[]) => execFileSync("git", ["-C", wikiDir, ...args], { encoding: "utf8" }),
): number {
  const repo = env.GITHUB_REPOSITORY ?? "digitalgroundgame/pragmatic-papers"
  const sha = env.GITHUB_SHA ?? "local"
  const state: WikiState = {
    headMessage: git(["log", "-1", "--format=%B"]),
    headSummary: git(["log", "-1", "--format=%h by %an: %s"]).trim(),
    everSynced: git(["log", "--format=%h", "--fixed-strings", `--grep=${MARKER}`]).trim() !== "",
  }
  const refused = refusal(state, env.FORCE === "true")
  if (refused) {
    log(`::error::${refused}`)
    return 1
  }

  mirror("wiki", wikiDir)
  git(["add", "--all"])
  const changed = git(["status", "--porcelain"]).trim()
  if (!changed) {
    log("The wiki already matches wiki/; nothing to sync.")
    return 0
  }
  log(`Changes:\n${changed}`)
  if (env.DRY_RUN === "true") {
    log("Dry run: nothing pushed.")
    return 0
  }
  git(["commit", "--quiet", "--message", syncMessage(repo, sha)])
  git(["push", "--quiet", "origin", "HEAD"])
  log(`Pushed to the wiki: ${syncMessage(repo, sha).split("\n")[0]}`)
  return 0
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const wikiDir = process.argv[2]
  if (!wikiDir) throw new Error("Usage: node scripts/sync-wiki.ts <wiki-clone-dir>")
  process.exitCode = main(wikiDir, process.env, (message) => process.stdout.write(`${message}\n`))
}
