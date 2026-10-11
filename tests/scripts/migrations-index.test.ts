import { execFileSync } from "node:child_process"
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import { buildMigrationsIndex } from "../../scripts/migrations-index"

const BASE = ["20250703_194534_init.ts", "20250703_194534_init.json", "index.ts"]

describe("buildMigrationsIndex", () => {
  it("lists only migration files, in timestamp order", () => {
    const index = buildMigrationsIndex(["20261012_100000_b.ts", ...BASE, "20261011_120000_a.ts"])
    expect(index).toMatchInlineSnapshot(`
      "import * as migration_20250703_194534_init from "./20250703_194534_init"
      import * as migration_20261011_120000_a from "./20261011_120000_a"
      import * as migration_20261012_100000_b from "./20261012_100000_b"

      // Written by scripts/migrations-index.ts (\`pnpm migrate:index\`), in timestamp order.
      const MIGRATIONS = {
        "20250703_194534_init": migration_20250703_194534_init,
        "20261011_120000_a": migration_20261011_120000_a,
        "20261012_100000_b": migration_20261012_100000_b,
      }

      export const migrations = Object.entries(MIGRATIONS).map(([name, migration]) => ({
        up: migration.up,
        down: migration.down,
        name,
      }))
      "
    `)
  })

  // What .gitattributes' `merge=union` does when two branches each add a migration.
  it("keeps both branches' migrations whole through a union merge", () => {
    const dir = mkdtempSync(join(tmpdir(), "migrations-index-"))
    const write = (name: string, files: string[]) => {
      writeFileSync(join(dir, name), buildMigrationsIndex(files))
      return join(dir, name)
    }
    const ours = write("ours.ts", [...BASE, "20261012_100000_ours.ts"])
    const base = write("base.ts", BASE)
    const theirs = write("theirs.ts", [...BASE, "20261011_120000_theirs.ts"])
    execFileSync("git", ["merge-file", "--union", ours, base, theirs])

    const merged = readFileSync(ours, "utf8")
    const both = buildMigrationsIndex([
      ...BASE,
      "20261012_100000_ours.ts",
      "20261011_120000_theirs.ts",
    ])
    expect(merged.split("\n").sort()).toEqual(both.split("\n").sort())
  })
})
