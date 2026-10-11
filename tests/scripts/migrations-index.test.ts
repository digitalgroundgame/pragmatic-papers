import { execFileSync } from "node:child_process"
import { mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import { afterEach, describe, expect, it, vi } from "vitest"
import {
  listedMigrations,
  main,
  mergeMigrations,
  migrationFiles,
  renderMigrationsIndex,
} from "../../scripts/migrations-index"

const SCRIPT = fileURLToPath(new URL("../../scripts/migrations-index.ts", import.meta.url))
const MIGRATIONS = fileURLToPath(new URL("../../src/migrations/", import.meta.url))

describe("migrationFiles", () => {
  it("lists only migration files, in timestamp order", () => {
    expect(
      migrationFiles([
        "20261012_100000_b.ts",
        "20261012_100000_b.json",
        "index.ts",
        "20261011_120000_a.ts",
      ]),
    ).toEqual(["20261011_120000_a", "20261012_100000_b"])
  })
})

describe("mergeMigrations", () => {
  it("keeps what either side added, in order", () => {
    expect(mergeMigrations(["a"], ["a", "c"], ["a", "b"])).toEqual(["a", "b", "c"])
  })

  it("drops what either side removed", () => {
    expect(mergeMigrations(["a", "b"], ["a"], ["a", "b", "c"])).toEqual(["a", "c"])
  })
})

describe("renderMigrationsIndex", () => {
  it("writes what Payload writes, as Prettier formats it: the committed index", async () => {
    const index = await renderMigrationsIndex(migrationFiles(readdirSync(MIGRATIONS)))
    expect(index).toBe(readFileSync(join(MIGRATIONS, "index.ts"), "utf8"))
    expect(listedMigrations(index)).toEqual(migrationFiles(readdirSync(MIGRATIONS)))
  })
})

// What .gitattributes' `merge=migrations-index` does when two branches each add a migration.
describe("the merge driver", () => {
  it("merges two branches that each add a migration without a conflict", async () => {
    const repo = mkdtempSync(join(tmpdir(), "migrations-index-merge-"))
    const git = (...args: string[]) =>
      execFileSync("git", ["-c", "user.name=test", "-c", "user.email=test@example.com", ...args], {
        cwd: repo,
        stdio: "pipe",
      })
    const commit = async (names: string[], message: string) => {
      writeFileSync(join(repo, "index.ts"), await renderMigrationsIndex(names))
      git("add", ".")
      git("commit", "-qm", message)
    }

    git("init", "-q", "-b", "main")
    git("config", "merge.migrations-index.driver", `node ${SCRIPT} --merge %O %A %B`)
    writeFileSync(join(repo, ".gitattributes"), "index.ts merge=migrations-index\n")
    await commit(["20250703_194534_init"], "base")
    git("checkout", "-qb", "theirs")
    await commit(["20250703_194534_init", "20261011_120000_theirs"], "theirs")
    git("checkout", "-q", "main")
    await commit(["20250703_194534_init", "20261012_100000_ours"], "ours")
    git("merge", "-q", "--no-edit", "theirs")

    expect(readFileSync(join(repo, "index.ts"), "utf8")).toBe(
      await renderMigrationsIndex([
        "20250703_194534_init",
        "20261011_120000_theirs",
        "20261012_100000_ours",
      ]),
    )
  }, 30_000)
})

describe("main", () => {
  const INIT = "20250703_194534_init"
  const ADDED = "20261011_120000_added"

  // A migrations folder holding these migrations, and an index listing `listed`.
  const folder = async (files: string[], listed: string[]) => {
    const dir = mkdtempSync(join(tmpdir(), "migrations-index-main-"))
    for (const name of files) writeFileSync(join(dir, `${name}.ts`), "")
    writeFileSync(join(dir, "index.ts"), await renderMigrationsIndex(listed))
    return dir
  }

  afterEach(() => {
    vi.restoreAllMocks()
    vi.doUnmock("payload")
    vi.resetModules()
  })

  it("passes --check when the index lists every migration", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined)
    expect(await main(["--check"], await folder([INIT, ADDED], [INIT, ADDED]))).toBe(0)
  })

  it("fails --check, naming the fix, when a migration is missing from the index", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined)
    const dir = await folder([INIT, ADDED], [INIT])
    expect(await main(["--check"], dir)).toBe(1)
    expect(error).toHaveBeenCalledWith(expect.stringContaining("pnpm migrate:index"))
    expect(listedMigrations(readFileSync(join(dir, "index.ts"), "utf8"))).toEqual([INIT])
  })

  it("rewrites a stale index", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined)
    const dir = await folder([INIT, ADDED], [INIT])
    expect(await main([], dir)).toBe(0)
    expect(readFileSync(join(dir, "index.ts"), "utf8")).toBe(
      await renderMigrationsIndex([INIT, ADDED]),
    )
  })

  it("--merge writes both sides' migrations into ours", async () => {
    const dir = mkdtempSync(join(tmpdir(), "migrations-index-driver-"))
    const write = async (file: string, names: string[]) => {
      writeFileSync(join(dir, file), await renderMigrationsIndex(names))
      return join(dir, file)
    }
    const base = await write("base", [INIT])
    const ours = await write("ours", [INIT, "20261012_100000_ours"])
    const theirs = await write("theirs", [INIT, ADDED])

    expect(await main(["--merge", base, ours, theirs])).toBe(0)
    expect(listedMigrations(readFileSync(ours, "utf8"))).toEqual([
      INIT,
      ADDED,
      "20261012_100000_ours",
    ])
  })

  it("--merge falls back to conflict markers when it can't render the index", async () => {
    const dir = mkdtempSync(join(tmpdir(), "migrations-index-driver-"))
    const write = async (file: string, names: string[]) => {
      writeFileSync(join(dir, file), await renderMigrationsIndex(names))
      return join(dir, file)
    }
    const base = await write("base", [INIT])
    const ours = await write("ours", [INIT, "20261012_100000_ours"])
    const theirs = await write("theirs", [INIT, ADDED])

    vi.doMock("payload", () => ({
      writeMigrationIndex: () => {
        throw new Error("payload isn't installed")
      },
    }))
    vi.resetModules()
    vi.spyOn(console, "error").mockImplementation(() => undefined)
    const { main: freshMain } = await import("../../scripts/migrations-index")

    expect(await freshMain(["--merge", base, ours, theirs])).toBe(1)
    const merged = readFileSync(ours, "utf8")
    expect(merged).toContain("<<<<<<< ours")
    expect(merged).toContain(">>>>>>> theirs")
  })
})
