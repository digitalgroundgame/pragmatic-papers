import { existsSync, readFileSync } from "node:fs"
import { join, resolve } from "node:path"
import { describe, expect, it } from "vitest"

import {
  CACHE_DIR,
  parseArgs,
  plan,
  refFor,
  SOURCES,
} from "../../.claude/skills/upstream-docs/fetch-docs"

const SKILL_DIR = resolve(__dirname, "../../.claude/skills/upstream-docs")
const dir = "/cache/github"

describe("parseArgs", () => {
  it("lists without a source", () => {
    expect(parseArgs([])).toBe("list")
    expect(parseArgs(["list"])).toBe("list")
  })

  it("reads a source, extra paths and --refresh", () => {
    expect(parseArgs(["github", "src/rest/data", "--refresh"])).toEqual({
      source: "github",
      paths: ["src/rest/data"],
      refresh: true,
    })
  })

  it("names the sources when one is unknown", () => {
    expect(() => parseArgs(["nextjs"])).toThrow(/Unknown source "nextjs". Sources: payload/)
  })

  it.each(["../escape", "/etc", "--depth=9999"])("rejects the path %j", (path) => {
    expect(() => parseArgs(["github", path])).toThrow(/Not a path inside the repo/)
  })
})

describe("refFor", () => {
  it("pins Payload to the installed version's tag", () => {
    expect(refFor(SOURCES.payload!, () => "3.90.2")).toBe("v3.90.2")
  })

  it("uses the branch for an unpinned source", () => {
    expect(refFor(SOURCES.cloudflare!)).toBe("production")
  })

  it("reads the version actually installed", () => {
    const { version } = JSON.parse(
      readFileSync(resolve(__dirname, "../../node_modules/payload/package.json"), "utf-8"),
    ) as { version: string }
    expect(refFor(SOURCES.payload!)).toBe(`v${version}`)
  })
})

describe("plan", () => {
  const options = { source: "github", paths: [], refresh: false }

  it("makes a shallow, blobless, sparse clone of the default paths", () => {
    const commands = plan(options, dir, "main", null)
    expect(commands[0]).toEqual(
      expect.arrayContaining([
        "clone",
        "--depth=1",
        "--filter=blob:none",
        "--sparse",
        "--branch=main",
        "https://github.com/github/docs.git",
        dir,
      ]),
    )
    expect(commands[1]).toEqual(["-C", dir, "sparse-checkout", "set", ...SOURCES.github!.paths])
    expect(commands).toContainEqual(["-C", dir, "config", "upstream-docs.ref", "main"])
  })

  it("clones a source without paths whole", () => {
    const commands = plan({ ...options, source: "wiki" }, "/cache/wiki", "master", null)
    expect(commands[0]).not.toContain("--sparse")
    expect(commands.some((command) => command.includes("sparse-checkout"))).toBe(false)
  })

  it("reuses a clone as it is", () => {
    expect(plan(options, dir, "main", { ref: "main" })).toEqual([])
  })

  it("adds extra paths to an existing clone", () => {
    expect(plan({ ...options, paths: ["src/rest/data"] }, dir, "main", { ref: "main" })).toEqual([
      ["-C", dir, "sparse-checkout", "add", "src/rest/data"],
    ])
  })

  it("moves to the newest commit on --refresh", () => {
    expect(plan({ ...options, refresh: true }, dir, "main", { ref: "main" })).toEqual([
      ["-C", dir, "fetch", "--quiet", "--depth=1", "origin", "main"],
      ["-C", dir, "reset", "--quiet", "--hard", "FETCH_HEAD"],
    ])
  })

  it("refetches when the pinned version changed", () => {
    const payload = { ...options, source: "payload" }
    expect(plan(payload, "/cache/payload", "v3.91.0", { ref: "v3.90.2" })).toEqual([
      ["-C", "/cache/payload", "fetch", "--quiet", "--depth=1", "origin", "v3.91.0"],
      ["-C", "/cache/payload", "reset", "--quiet", "--hard", "FETCH_HEAD"],
      ["-C", "/cache/payload", "config", "upstream-docs.ref", "v3.91.0"],
    ])
  })
})

describe("the skill", () => {
  it("caches inside the repo's gitignored .cache", () => {
    expect(CACHE_DIR).toBe(resolve(__dirname, "../../.cache/upstream-docs"))
    expect(readFileSync(resolve(__dirname, "../../.gitignore"), "utf-8")).toMatch(/^\/\.cache\/$/m)
  })

  it.each(Object.keys(SOURCES))("has a guide for %s, listed in SKILL.md", (name) => {
    expect(existsSync(join(SKILL_DIR, "references", `${name}.md`))).toBe(true)
    expect(readFileSync(join(SKILL_DIR, "SKILL.md"), "utf-8")).toContain(`references/${name}.md`)
  })
})
