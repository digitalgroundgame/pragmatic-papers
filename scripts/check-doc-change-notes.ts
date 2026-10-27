/**
 * Checks that every help doc a branch changes, among those a site may already have, carries a
 * new `changeNote` in its front matter. A deploy never changes a doc a site has: it lists the
 * change beside the doc as a suggestion for the site's editors, and the note is what tells them
 * what the change is about. New docs need none: a site that doesn't have one gets it whole.
 *
 *   node scripts/check-doc-change-notes.ts [--base <ref>]
 *
 * `--base` is what the branch is compared with: CI passes the pull request's base, and it
 * defaults to where the branch left origin/dev. Plain Node runs it (no dependencies), so it reads
 * the note with its own small parser rather than the docs plugin's.
 */
import { execFileSync } from "node:child_process"
import { fileURLToPath } from "node:url"

const DOCS = "src/docs/"

const runGit = (args: string[]): string =>
  execFileSync("git", args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 })

export interface DocChange {
  path: string
  before: string
  after: string
}

/** The front matter's `changeNote`, unquoted, or null when it has none. */
export function changeNoteOf(source: string): string | null {
  const front = /^---\r?\n([\s\S]*?)\r?\n---/.exec(source)?.[1]
  const raw = front && /^changeNote:[ \t]*(.*)$/m.exec(front)?.[1]?.trim()
  if (!raw) return null
  if (raw.startsWith('"')) {
    try {
      return (JSON.parse(raw) as string).trim() || null
    } catch {
      return raw
    }
  }
  return raw
}

/** What's wrong with each changed doc, as a line to print; empty when every doc is fine. */
export function checkChangeNotes(changes: DocChange[]): string[] {
  return changes.flatMap(({ path, before, after }) => {
    if (before === after) return []
    const note = changeNoteOf(after)
    if (!note) {
      return [
        `${path}: give it a changeNote in its front matter, a sentence telling the editors who own the doc what changed.`,
      ]
    }
    if (note === changeNoteOf(before)) {
      return [
        `${path}: its changeNote is the one from its last change. Replace it with a sentence about this one.`,
      ]
    }
    return []
  })
}

/**
 * Each doc the branch changed since `base` that existed there (renamed or not), with both
 * copies. Added and deleted docs aren't listed.
 */
export function changedDocs(base: string, git = runGit): DocChange[] {
  const lines = git(["diff", "--name-status", "-M", "--diff-filter=MR", base, "HEAD", "--", DOCS])
    .split("\n")
    .filter(Boolean)
  return lines.flatMap((line) => {
    const [, from, to = from] = line.split("\t")
    if (!from?.endsWith(".md") || !to?.endsWith(".md")) return []
    return [
      { path: to, before: git(["show", `${base}:${from}`]), after: git(["show", `HEAD:${to}`]) },
    ]
  })
}

export function main(args: readonly string[], git = runGit): number {
  const i = args.indexOf("--base")
  const base = i >= 0 ? args[i + 1]! : git(["merge-base", "origin/dev", "HEAD"]).trim()
  const problems = checkChangeNotes(changedDocs(base, git))
  if (!problems.length) {
    console.warn("Every changed help doc has a new changeNote.")
    return 0
  }
  for (const problem of problems) console.error(problem)
  console.error(
    "\nSites that already have these docs get each change as a suggestion for their editors, with its changeNote saying what it's about.",
  )
  return 1
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exitCode = main(process.argv.slice(2))
}
