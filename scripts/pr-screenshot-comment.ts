// Upload screenshot PNGs to the pr-screenshots assets branch and upsert a
// single marker-identified comment on a PR. Invoked from
// .github/workflows/playwright.yml via `pnpm exec tsx`.
//
// Reads PNG file paths from stdin (one per line, order preserved in the grid).
// Required env: GH_TOKEN, OWNER, REPO, PR_NUMBER, ASSET_DIR
// Optional env: ASSETS_BRANCH (default pr-screenshots), MARKER, TITLE,
//   COLUMNS_PER_ROW, FOOTER (comment rendering), DELETE_WHEN_EMPTY=true to
//   remove a stale comment when no files are given.

import { execFileSync } from "node:child_process"
import { createHash } from "node:crypto"
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { basename, join } from "node:path"

import { buildCommentBody, readStdin } from "./snapshot-comment"

function run(
  cmd: string,
  args: string[],
  opts: { cwd?: string; allowFail?: boolean } = {},
): string {
  try {
    return execFileSync(cmd, args, { cwd: opts.cwd, encoding: "utf8" })
  } catch (error) {
    if (opts.allowFail) return ""
    throw error
  }
}

/** Pull the content fingerprint out of a previously posted comment body. */
export function extractFingerprint(body: string, marker: string): string | null {
  const match = body.match(new RegExp(`^<!-- ${marker}:([0-9a-f]*) -->`))
  return match ? (match[1] ?? "") : null
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

/**
 * Collect the `<pr>/<sha>` asset directories that existing PR comments still
 * link to, by scanning their bodies for raw.githubusercontent URLs pointing at
 * this PR's folder on the assets branch. Returns the set of referenced sha
 * directory names so a self-prune can keep them and drop only orphaned ones.
 */
export function referencedShas(
  bodies: string[],
  opts: { owner: string; repo: string; branch: string; prNumber: string },
): Set<string> {
  const { owner, repo, branch, prNumber } = opts
  const pattern = new RegExp(
    `raw\\.githubusercontent\\.com/${escapeRegExp(owner)}/${escapeRegExp(repo)}/` +
      `${escapeRegExp(branch)}/${escapeRegExp(prNumber)}/([^/"'\\s)]+)`,
    "g",
  )
  const shas = new Set<string>()
  for (const body of bodies) {
    for (const match of body.matchAll(pattern)) {
      if (match[1]) shas.add(match[1])
    }
  }
  return shas
}

/** Order-independent fingerprint of the given files' contents. */
export function fingerprintFiles(paths: string[], readFile = readFileSync): string {
  const hash = createHash("sha256")
  for (const path of [...paths].sort()) {
    hash.update(basename(path))
    hash.update(readFile(path))
  }
  return hash.digest("hex")
}

export async function main(): Promise<void> {
  const { GH_TOKEN, OWNER, REPO, PR_NUMBER, ASSET_DIR } = process.env
  if (!GH_TOKEN || !OWNER || !REPO || !PR_NUMBER || !ASSET_DIR) {
    throw new Error("GH_TOKEN, OWNER, REPO, PR_NUMBER and ASSET_DIR are required")
  }
  const assetsBranch = process.env.ASSETS_BRANCH || "pr-screenshots"
  const marker = process.env.MARKER || "screenshots"

  const files = (await readStdin())
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && existsSync(l))

  const commentsJson = run("gh", ["api", `repos/${OWNER}/${REPO}/issues/${PR_NUMBER}/comments`])
  const comments = JSON.parse(commentsJson) as { id: number; body: string }[]
  const existing = comments.find((c) => c.body.startsWith(`<!-- ${marker}:`))

  if (files.length === 0) {
    if (process.env.DELETE_WHEN_EMPTY === "true" && existing) {
      run("gh", [
        "api",
        "--method",
        "DELETE",
        `repos/${OWNER}/${REPO}/issues/comments/${existing.id}`,
      ])
      console.warn(`Removed stale '${marker}' comment.`)
    } else {
      console.warn("No files and no stale comment — nothing to do.")
    }
    return
  }

  const fingerprint = fingerprintFiles(files)
  if (existing && extractFingerprint(existing.body, marker) === fingerprint) {
    console.warn("Screenshots unchanged — skipping upload.")
    return
  }

  run("git", ["config", "--global", "user.name", "github-actions[bot]"])
  run("git", [
    "config",
    "--global",
    "user.email",
    "41898282+github-actions[bot]@users.noreply.github.com",
  ])

  const remote = `https://x-access-token:${GH_TOKEN}@github.com/${OWNER}/${REPO}.git`
  const assets = join(mkdtempSync(join(tmpdir(), "pr-screenshots-")), "assets")

  const branchExists =
    run("git", ["ls-remote", "--exit-code", remote, `refs/heads/${assetsBranch}`], {
      allowFail: true,
    }) !== ""
  if (branchExists) {
    run("git", ["clone", "--depth=1", "--branch", assetsBranch, remote, assets])
  } else {
    run("git", ["clone", "--depth=1", remote, assets])
    run("git", ["checkout", "--orphan", assetsBranch], { cwd: assets })
    run("git", ["rm", "-rf", "."], { cwd: assets, allowFail: true })
  }

  mkdirSync(join(assets, ASSET_DIR), { recursive: true })
  for (const src of files) {
    copyFileSync(src, join(assets, ASSET_DIR, basename(src)))
  }

  // Self-prune: this PR only ever needs the sha dir we're uploading now plus any
  // sha another still-live comment links to. Everything else under the PR folder
  // is a leftover from an earlier commit's run — drop it so the branch doesn't
  // grow one full screenshot set per push forever. `existing` is excluded from
  // the keep set because we're about to repoint it at the current sha.
  // ASSET_DIR is always `<pr>/<sha>[/regressions]`, so the PR folder is PR_NUMBER.
  const currentSha = ASSET_DIR.split("/")[1]
  const keep = referencedShas(
    comments.filter((c) => c.id !== existing?.id).map((c) => c.body),
    { owner: OWNER, repo: REPO, branch: assetsBranch, prNumber: PR_NUMBER },
  )
  if (currentSha) keep.add(currentSha)
  for (const entry of readdirSync(join(assets, PR_NUMBER), { withFileTypes: true })) {
    if (entry.isDirectory() && !keep.has(entry.name)) {
      run("git", ["rm", "-r", "--quiet", join(PR_NUMBER, entry.name)], {
        cwd: assets,
        allowFail: true,
      })
    }
  }

  run("git", ["add", ASSET_DIR], { cwd: assets })
  run("git", ["commit", "-m", `screenshots: PR #${PR_NUMBER} (${marker}) ${ASSET_DIR}`], {
    cwd: assets,
  })
  run("git", ["push", remote, assetsBranch], { cwd: assets })

  const columns = Number(process.env.COLUMNS_PER_ROW)
  const body = buildCommentBody({
    fingerprint,
    baseUrl: `https://raw.githubusercontent.com/${OWNER}/${REPO}/${assetsBranch}/${ASSET_DIR}`,
    paths: files,
    marker,
    title: process.env.TITLE || undefined,
    columns: Number.isFinite(columns) && columns > 0 ? columns : undefined,
    footer: process.env.FOOTER || undefined,
  })

  if (existing) {
    run("gh", [
      "api",
      "--method",
      "PATCH",
      `repos/${OWNER}/${REPO}/issues/comments/${existing.id}`,
      "-f",
      `body=${body}`,
    ])
    console.warn(`'${marker}' comment updated on PR #${PR_NUMBER}.`)
  } else {
    run("gh", ["pr", "comment", PR_NUMBER, "--repo", `${OWNER}/${REPO}`, "--body", body])
    console.warn(`'${marker}' comment posted on PR #${PR_NUMBER}.`)
  }
}

// CLI entry point — only runs when executed directly, not when imported.
/* v8 ignore next 3 */
if (process.argv[1] === import.meta.filename) {
  await main()
}
