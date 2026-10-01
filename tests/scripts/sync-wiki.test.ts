import { execFileSync } from "node:child_process"
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

import { listFiles, main, MARKER, mirror, refusal, syncMessage } from "../../scripts/sync-wiki"

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

describe("main, against real git repositories", () => {
  const SHA = "0123456789abcdef0123456789abcdef01234567"
  const run = (dir: string, ...args: string[]) =>
    execFileSync("git", ["-C", dir, ...args], { encoding: "utf8" })
  const commitAll = (dir: string, message: string) => {
    run(dir, "add", "--all")
    run(dir, "-c", "user.name=ana", "-c", "user.email=a@example.com", "commit", "-qm", message)
  }

  /** A bare "GitHub" wiki holding Home.md, a clone of it, and a wiki/ folder to publish. */
  function setup(pages: Record<string, string>) {
    const root = mkdtempSync(join(tmpdir(), "sync-"))
    const origin = join(root, "origin.git")
    const seed = join(root, "seed")
    const clone = join(root, "clone")
    const source = join(root, "source")
    execFileSync("git", ["init", "-q", "--bare", "-b", "master", origin])
    execFileSync("git", ["clone", "-q", origin, seed])
    writeFileSync(join(seed, "Home.md"), "old home\n")
    commitAll(seed, "Initial Home")
    run(seed, "push", "-q", "origin", "HEAD:master")
    execFileSync("git", ["clone", "-q", origin, clone])
    run(clone, "config", "user.name", "github-actions[bot]")
    run(clone, "config", "user.email", "bot@example.com")
    mkdirSync(source)
    for (const [name, content] of Object.entries(pages)) writeFileSync(join(source, name), content)
    return { origin, seed, clone, source }
  }
  const sync = (
    { clone, source }: { clone: string; source: string },
    env: Record<string, string> = {},
  ) => {
    const logs: string[] = []
    const code = main({
      wikiDir: clone,
      sourceDir: source,
      env: { GITHUB_REPOSITORY: "o/r", GITHUB_SHA: SHA, ...env },
      log: (message) => logs.push(message),
    })
    return { code, logs: logs.join("\n") }
  }
  const originLog = (origin: string) => run(origin, "log", "--format=%s", "master").trim()

  it("pushes the first sync as one marked commit", () => {
    const repos = setup({ "Home.md": "new home\n", "Page.md": "page\n" })
    expect(sync(repos).code).toBe(0)
    expect(originLog(repos.origin).split("\n")[0]).toBe("docs: sync from o/r@0123456")
    expect(run(repos.origin, "show", "master:Page.md")).toBe("page\n")
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

  it("refuses after a direct edit since the last sync, and overwrites it when forced", () => {
    const repos = setup({ "Home.md": "new home\n" })
    sync(repos)
    run(repos.seed, "pull", "-q", "origin", "master")
    writeFileSync(join(repos.seed, "Home.md"), "edited on the wiki\n")
    commitAll(repos.seed, "Updated Home (markdown)")
    run(repos.seed, "push", "-q", "origin", "HEAD:master")
    run(repos.clone, "pull", "-q", "origin", "master")
    writeFileSync(join(repos.source, "Home.md"), "newer home\n")

    const refused = sync(repos)
    expect(refused.code).toBe(1)
    expect(refused.logs).toContain("by ana: Updated Home (markdown)")
    expect(run(repos.origin, "show", "master:Home.md")).toBe("edited on the wiki\n")

    expect(sync(repos, { FORCE: "true" }).code).toBe(0)
    expect(run(repos.origin, "show", "master:Home.md")).toBe("newer home\n")
  })
})
