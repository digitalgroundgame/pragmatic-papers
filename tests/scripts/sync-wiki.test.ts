import { execFileSync } from "node:child_process"
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

import {
  listFiles,
  main,
  MARKER,
  mirror,
  refusal,
  syncedSha,
  syncMessage,
} from "../../scripts/sync-wiki"

describe("refusal", () => {
  const synced = {
    headMessage: syncMessage("o/r", "a".repeat(40)),
    headSummary: "abc",
    everSynced: true,
  }
  const edited = {
    headMessage: "Updated Home (markdown)",
    headSummary: "def by ana: Updated Home",
    everSynced: true,
  }

  it("lets a sync follow a sync", () => {
    expect(refusal(synced, false)).toBeUndefined()
  })

  it("refuses to overwrite a page edited on the wiki since the last sync", () => {
    expect(refusal(edited, false)).toContain(
      "edited directly since the last sync (def by ana: Updated Home)",
    )
  })

  it("overwrites it when forced", () => {
    expect(refusal(edited, true)).toBeUndefined()
  })

  it("lets the first sync through, since wiki/ was copied from the wiki", () => {
    expect(refusal({ ...edited, everSynced: false }, false)).toBeUndefined()
  })
})

describe("syncMessage", () => {
  it("names the repo commit, with the marker the next run looks for", () => {
    const message = syncMessage("o/r", "0123456789abcdef0123456789abcdef01234567")
    expect(message.split("\n")[0]).toBe("docs: sync from o/r@0123456")
    expect(message).toContain(`${MARKER}o/r@0123456789abcdef0123456789abcdef01234567`)
  })
})

describe("mirror", () => {
  const tree = (files: Record<string, string>) => {
    const dir = mkdtempSync(join(tmpdir(), "wiki-"))
    for (const [path, content] of Object.entries(files)) {
      mkdirSync(join(dir, path, ".."), { recursive: true })
      writeFileSync(join(dir, path), content)
    }
    return dir
  }

  it("adds, updates and deletes pages, and leaves .git alone", () => {
    const source = tree({ "Home.md": "new home", "New-Page.md": "new", "images/a.png": "png" })
    const target = tree({ "Home.md": "old home", "Gone.md": "gone", ".git/HEAD": "ref" })
    mirror(source, target)
    expect(listFiles(target)).toEqual(["Home.md", "New-Page.md", "images/a.png"])
    expect(readFileSync(join(target, "Home.md"), "utf8")).toBe("new home")
    expect(readFileSync(join(target, ".git/HEAD"), "utf8")).toBe("ref")
  })
})

describe("syncedSha", () => {
  it("reads the repo commit back out of a sync message", () => {
    const sha = "0123456789abcdef0123456789abcdef01234567"
    expect(syncedSha(syncMessage("o/r", sha), "o/r")).toBe(sha)
    expect(syncedSha(syncMessage("o/r", sha), "other/repo")).toBeUndefined()
    expect(syncedSha("Updated Home (markdown)", "o/r")).toBeUndefined()
  })
})

describe("main, against real git repositories", () => {
  const run = (dir: string, ...args: string[]) =>
    execFileSync("git", ["-C", dir, ...args], { encoding: "utf8" })
  const commitAll = (dir: string, message: string) => {
    run(dir, "add", "--all")
    run(dir, "-c", "user.name=ana", "-c", "user.email=a@example.com", "commit", "-qm", message)
    return run(dir, "rev-parse", "HEAD").trim()
  }

  /** Replace the repo's wiki/ with `pages` and commit it, returning the commit. */
  const writePages = ({ repo }: { repo: string }, pages: Record<string, string>) => {
    rmSync(join(repo, "wiki"), { recursive: true, force: true })
    mkdirSync(join(repo, "wiki"))
    for (const [name, content] of Object.entries(pages))
      writeFileSync(join(repo, "wiki", name), content)
    return commitAll(repo, "wiki change")
  }
  /**
   * A bare "GitHub" wiki holding Home.md, a clone of it to sync into, and a
   * repo whose wiki/ holds `pages`, committed.
   */
  function setup(pages: Record<string, string>) {
    const root = mkdtempSync(join(tmpdir(), "sync-"))
    const origin = join(root, "origin.git")
    const seed = join(root, "seed")
    const clone = join(root, "clone")
    const repo = join(root, "repo")
    execFileSync("git", ["init", "-q", "--bare", "-b", "master", origin])
    execFileSync("git", ["clone", "-q", origin, seed])
    writeFileSync(join(seed, "Home.md"), "old home\n")
    commitAll(seed, "Initial Home")
    run(seed, "push", "-q", "origin", "HEAD:master")
    execFileSync("git", ["clone", "-q", origin, clone])
    run(clone, "config", "user.name", "github-actions[bot]")
    run(clone, "config", "user.email", "bot@example.com")
    execFileSync("git", ["init", "-q", "-b", "dev", repo])
    const repos = { origin, seed, clone, repo }
    writePages(repos, pages)
    return repos
  }
  const sync = (
    { clone, repo }: { clone: string; repo: string },
    env: Record<string, string> = {},
  ) => {
    const logs: string[] = []
    const code = main({
      wikiDir: clone,
      repoDir: repo,
      env: { GITHUB_REPOSITORY: "o/r", GITHUB_SHA: run(repo, "rev-parse", "HEAD").trim(), ...env },
      log: (message) => logs.push(message),
    })
    return { code, logs: logs.join("\n") }
  }
  const originLog = (origin: string) => run(origin, "log", "--format=%s", "master").trim()
  const published = (origin: string, page = "Home.md") => run(origin, "show", `master:${page}`)

  it("pushes the first sync as one marked commit", () => {
    const repos = setup({ "Home.md": "new home\n", "Page.md": "page\n" })
    const head = run(repos.repo, "rev-parse", "HEAD").trim()
    expect(sync(repos).code).toBe(0)
    expect(originLog(repos.origin).split("\n")[0]).toBe(`docs: sync from o/r@${head.slice(0, 7)}`)
    expect(published(repos.origin, "Page.md")).toBe("page\n")
  })

  it("does nothing when the wiki already matches", () => {
    const repos = setup({ "Home.md": "old home\n" })
    const { code, logs } = sync(repos)
    expect(code).toBe(0)
    expect(logs).toContain("nothing to sync")
    expect(originLog(repos.origin)).toBe("Initial Home")
  })

  it("pushes nothing on a dry run", () => {
    const repos = setup({ "Home.md": "new home\n" })
    const { code, logs } = sync(repos, { DRY_RUN: "true" })
    expect(code).toBe(0)
    expect(logs).toContain("M  Home.md")
    expect(originLog(repos.origin)).toBe("Initial Home")
  })

  it("doesn't roll back a newer sync when an older commit, such as a release, comes later", () => {
    const repos = setup({ "Home.md": "candidate home\n" })
    const candidate = run(repos.repo, "rev-parse", "HEAD").trim()
    writePages(repos, { "Home.md": "doc fix from dev\n" })
    expect(sync(repos).code).toBe(0)

    run(repos.repo, "checkout", "-q", candidate)
    const { code, logs } = sync(repos)
    expect(code).toBe(0)
    expect(logs).toContain("adds no change to wiki/")
    expect(published(repos.origin)).toBe("doc fix from dev\n")

    run(repos.repo, "checkout", "-q", "dev")
    writePages(repos, { "Home.md": "next release\n" })
    expect(sync(repos).code).toBe(0)
    expect(published(repos.origin)).toBe("next release\n")
  })

  it("refuses after a direct edit since the last sync, and overwrites it when forced", () => {
    const repos = setup({ "Home.md": "new home\n" })
    sync(repos)
    run(repos.seed, "pull", "-q", "origin", "master")
    writeFileSync(join(repos.seed, "Home.md"), "edited on the wiki\n")
    commitAll(repos.seed, "Updated Home (markdown)")
    run(repos.seed, "push", "-q", "origin", "HEAD:master")
    run(repos.clone, "pull", "-q", "origin", "master")
    writePages(repos, { "Home.md": "newer home\n" })

    const refused = sync(repos)
    expect(refused.code).toBe(1)
    expect(refused.logs).toContain("by ana: Updated Home (markdown)")
    expect(published(repos.origin)).toBe("edited on the wiki\n")

    expect(sync(repos, { FORCE: "true" }).code).toBe(0)
    expect(published(repos.origin)).toBe("newer home\n")
  })
})
