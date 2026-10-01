import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { hostname, tmpdir } from "node:os"
import path from "node:path"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  assertNotDevDatabase,
  BASE_IMAGE,
  OWNER_LABEL,
  pruneSnapshots,
  snapshotTag,
  startTestDatabase,
  sweepOrphans,
} from "../../scripts/test-db.mjs"

describe("assertNotDevDatabase()", () => {
  const DEV = "postgres://postgres:postgres@localhost:9000/pragmatic-papers"

  it("refuses the dev database, however its host is spelled", () => {
    for (const host of ["localhost", "127.0.0.1", "[::1]"]) {
      expect(() =>
        assertNotDevDatabase(`postgres://other:secret@${host}:9000/pragmatic-papers`, DEV),
      ).toThrow("Refusing to run tests against localhost:9000/pragmatic-papers")
    }
  })

  it.each([
    ["another port", "postgres://postgres:postgres@localhost:5432/pragmatic-papers"],
    ["another database", "postgres://postgres:postgres@localhost:9000/pp_test"],
    ["another host", "postgres://postgres:postgres@postgres:9000/pragmatic-papers"],
  ])("accepts %s", (_, uri) => {
    expect(() => assertNotDevDatabase(uri, DEV)).not.toThrow()
  })

  it("accepts anything when .env names no database", () => {
    expect(() => assertNotDevDatabase(DEV, undefined)).not.toThrow()
  })

  it("refuses a malformed TEST_DATABASE_URI", () => {
    expect(() => assertNotDevDatabase("not a uri", DEV)).toThrow("isn't a valid")
  })
})

describe("snapshotTag()", () => {
  let dir: string

  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), "test-db-"))
    mkdirSync(path.join(dir, "nested"))
    writeFileSync(path.join(dir, "001_init.ts"), "export const up = 1")
    writeFileSync(path.join(dir, "nested", "002.json"), "{}")
  })

  afterEach(() => rmSync(dir, { recursive: true, force: true }))

  const tag = (baseImageId = "sha256:abc") => snapshotTag({ baseImageId, migrationsDir: dir })

  it("is stable while nothing changes", () => {
    expect(tag()).toMatch(/^pragmatic-papers-test-db:[0-9a-f]{16}$/)
    expect(tag()).toBe(tag())
  })

  it("changes when a migration is edited, added or renamed", () => {
    const before = tag()
    writeFileSync(path.join(dir, "nested", "002.json"), '{"x":1}')
    const edited = tag()
    writeFileSync(path.join(dir, "003_more.ts"), "")
    const added = tag()
    rmSync(path.join(dir, "003_more.ts"))
    writeFileSync(path.join(dir, "003_renamed.ts"), "")
    expect(new Set([before, edited, added, tag()]).size).toBe(4)
  })

  it("changes with the Postgres image", () => {
    expect(tag("sha256:abc")).not.toBe(tag("sha256:def"))
  })
})

describe("sweepOrphans()", () => {
  it("removes containers whose owner on this host has died, and nothing else", () => {
    const docker = vi.fn((args: string[]) => {
      if (args[0] === "ps") {
        return [
          "dead1 myhost:100",
          "live1 myhost:200",
          "other otherhost:100",
          "weird myhost:notapid",
        ].join("\n")
      }
      return ""
    })
    const removed = sweepOrphans({ docker, host: "myhost", alive: (pid) => pid === 200 })
    expect(removed).toEqual(["dead1"])
    expect(docker).toHaveBeenCalledWith(["rm", "-f", "dead1"])
    expect(docker.mock.calls[0]).toEqual([
      expect.arrayContaining([`label=${OWNER_LABEL}`, `{{.ID}} {{.Label "${OWNER_LABEL}"}}`]),
    ])
  })

  it("handles no containers", () => {
    expect(sweepOrphans({ docker: () => "", host: "h", alive: () => false })).toEqual([])
  })
})

describe("pruneSnapshots()", () => {
  it("keeps the current snapshot and the two newest others", () => {
    const docker = vi.fn((args: string[]) =>
      args[0] === "image"
        ? ["repo:new", "repo:current", "repo:b", "repo:c", "repo:d"].join("\n")
        : "",
    )
    pruneSnapshots("repo:current", { docker })
    const removed = docker.mock.calls.filter(([args]) => args[0] === "rmi").map(([args]) => args[1])
    expect(removed).toEqual(["repo:c", "repo:d"])
  })

  it("ignores a snapshot that's still in use", () => {
    const docker = vi.fn((args: string[]) => {
      if (args[0] === "rmi") throw new Error("image is being used")
      return "repo:a\nrepo:b\nrepo:c\nrepo:d"
    })
    expect(() => pruneSnapshots("repo:a", { docker })).not.toThrow()
  })
})

describe("startTestDatabase()", () => {
  const log = vi.fn()

  /** A fake Docker CLI: `images` exist, `run` hands out sequential container ids. */
  function fakeDocker(images: string[] = [BASE_IMAGE]) {
    let next = 0
    const calls: string[][] = []
    const docker = vi.fn((args: string[]): string => {
      calls.push(args)
      const [command, sub] = args
      if (command === "ps") return ""
      if (command === "image" && sub === "inspect") {
        const image = args.at(-1)!
        if (!images.includes(image)) throw new Error(`No such image: ${image}`)
        return args.includes("-f") ? "sha256:base" : "[]"
      }
      if (command === "run") return `container${++next}`
      if (command === "port") return `127.0.0.1:5${next}000`
      if (command === "commit") images.push(args[2]!)
      if (command === "image" && sub === "ls") return ""
      return ""
    })
    return { docker, calls, images }
  }

  const runs = (calls: string[][]) => calls.filter(([command]) => command === "run")

  it("uses TEST_DATABASE_URI without Docker, and migrates it", async () => {
    const { docker } = fakeDocker()
    const migrate = vi.fn()
    const uri = "postgres://u:p@db.example:5432/tests"
    const db = await startTestDatabase({ migrate, docker, log, env: { TEST_DATABASE_URI: uri } })
    expect(db).toMatchObject({ uri, fromSnapshot: false })
    expect(migrate).toHaveBeenCalledWith(uri)
    expect(docker).not.toHaveBeenCalled()
    db.stop()
  })

  it("starts a throwaway container, migrates it and removes it on stop", async () => {
    const { docker, calls } = fakeDocker()
    const migrate = vi.fn()
    const db = await startTestDatabase({ migrate, docker, log, env: {} })
    expect(db.uri).toBe("postgres://postgres:postgres@127.0.0.1:51000/pragmatic-papers-test")
    expect(migrate).toHaveBeenCalledWith(db.uri)
    const [run] = runs(calls)
    expect(run).toEqual(
      expect.arrayContaining([
        "--rm",
        "127.0.0.1::5432",
        `${OWNER_LABEL}=${hostname()}:${process.pid}`,
      ]),
    )
    expect(calls.some(([command]) => command === "commit")).toBe(false)
    db.stop()
    expect(calls.at(-1)).toEqual(["rm", "-f", "-v", "container1"])
  })

  it("migrates once and commits a snapshot on a miss, then starts from it on a hit", async () => {
    const { docker, calls, images } = fakeDocker()
    const migrate = vi.fn()

    const first = await startTestDatabase({ migrate, docker, log, snapshot: true, env: {} })
    expect(migrate).toHaveBeenCalledTimes(1)
    expect(first.fromSnapshot).toBe(false)
    const tag = images.at(-1)!
    expect(tag).toMatch(/^pragmatic-papers-test-db:/)
    // Kept on stop so it can be committed after a clean shutdown, then served from the snapshot.
    const [migrated, served] = runs(calls)
    expect(migrated).not.toContain("--rm")
    expect(calls).toContainEqual(["stop", "container1"])
    expect(calls).toContainEqual(["commit", "container1", tag])
    expect(served).toContain("--rm")
    expect(served!.at(-1)).toBe(tag)
    first.stop()

    calls.length = 0
    const second = await startTestDatabase({ migrate, docker, log, snapshot: true, env: {} })
    expect(migrate).toHaveBeenCalledTimes(1)
    expect(second.fromSnapshot).toBe(true)
    expect(runs(calls)).toHaveLength(1)
    expect(runs(calls)[0]!.at(-1)).toBe(tag)
    second.stop()
  })

  it("never snapshots in CI", async () => {
    const { docker, calls } = fakeDocker()
    const migrate = vi.fn()
    const db = await startTestDatabase({
      migrate,
      docker,
      log,
      snapshot: true,
      env: { CI: "true" },
    })
    expect(migrate).toHaveBeenCalledTimes(1)
    expect(calls.some(([command]) => command === "commit")).toBe(false)
    db.stop()
  })

  it("removes the container when migrating fails", async () => {
    const { docker, calls } = fakeDocker()
    const migrate = vi.fn(() => {
      throw new Error("migration failed")
    })
    await expect(startTestDatabase({ migrate, docker, log, env: {} })).rejects.toThrow(
      "migration failed",
    )
    expect(calls.at(-1)).toEqual(["rm", "-f", "-v", "container1"])
  })

  it("leaves no exit or signal handlers behind once stopped", async () => {
    const before = ["exit", "SIGINT", "SIGTERM"].map((event) => process.listenerCount(event))
    const db = await startTestDatabase({
      migrate: vi.fn(),
      docker: fakeDocker().docker,
      log,
      env: {},
    })
    expect(process.listenerCount("SIGINT")).toBe(before[1]! + 1)
    db.stop()
    expect(["exit", "SIGINT", "SIGTERM"].map((event) => process.listenerCount(event))).toEqual(
      before,
    )
  })
})
