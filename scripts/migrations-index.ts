// src/migrations/index.ts is the list `payload migrate:create` writes (Payload's
// writeMigrationIndex, then Prettier). Every new migration appends to it, so two
// branches that each add one conflict there. .gitattributes hands that file to
// the `migrations-index` merge driver (scripts/setup-git.mjs registers it on
// `pnpm install`), which runs this with `--merge`: it takes the migrations
// both sides list and writes the file again the way Payload would.
//
//   pnpm migrate:index          rewrite the index from the migration files
//   pnpm migrate:index --check  only compare (CI's Static checks)
//   node scripts/migrations-index.ts --merge <base> <ours> <theirs>   (git runs this)
import { execFileSync } from "node:child_process"
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { fileURLToPath } from "node:url"

const DIR = fileURLToPath(new URL("../src/migrations/", import.meta.url))
const INDEX = join(DIR, "index.ts")

/** The migrations a directory holds, by file name: `<yyyymmdd>_<hhmmss>_<name>`. */
export function migrationFiles(files: readonly string[]): string[] {
  return files
    .filter((file) => /^\d{8}_\d{6}_.+\.ts$/.test(file))
    .map((file) => file.slice(0, -".ts".length))
    .sort()
}

/** The migrations an index lists, from its `name:` entries. */
export function listedMigrations(index: string): string[] {
  return [...index.matchAll(/^\s*name: ["']([^"']+)["'],?$/gm)].map((match) => match[1]!)
}

/**
 * A three-way merge of the migrations two branches list: everything either side
 * has, less what either side removed since the base.
 */
export function mergeMigrations(
  base: readonly string[],
  ours: readonly string[],
  theirs: readonly string[],
): string[] {
  const removed = new Set(base.filter((name) => !ours.includes(name) || !theirs.includes(name)))
  return [...new Set([...ours, ...theirs])].filter((name) => !removed.has(name)).sort()
}

/** The index `payload migrate:create` would write for these migrations. */
export async function renderMigrationsIndex(names: readonly string[]): Promise<string> {
  const [{ writeMigrationIndex }, prettier] = await Promise.all([
    import("payload"),
    import("prettier"),
  ])
  // writeMigrationIndex only takes a directory, so give it one holding these names.
  const dir = mkdtempSync(join(tmpdir(), "migrations-index-"))
  try {
    for (const name of names) writeFileSync(join(dir, `${name}.ts`), "")
    writeMigrationIndex({ migrationsDir: dir })
    const source = readFileSync(join(dir, "index.ts"), "utf8")
    // Without the config's plugins: they resolve from the working directory, which is
    // another checkout when git runs this, and none of them touches this file.
    const options = await prettier.resolveConfig(INDEX)
    return await prettier.format(source, { ...options, plugins: [], filepath: INDEX })
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

/**
 * The merge driver: writes the merge of `base`, `ours` and `theirs` into `ours`, as git
 * expects. If that fails, it falls back to git's own text merge and reports a conflict,
 * so the file gets conflict markers instead of silently keeping only our side.
 */
async function mergeIndexFiles(base: string, ours: string, theirs: string): Promise<number> {
  try {
    const [b, o, t] = [base, ours, theirs].map((file) =>
      listedMigrations(readFileSync(file, "utf8")),
    )
    writeFileSync(ours, await renderMigrationsIndex(mergeMigrations(b!, o!, t!)))
    return 0
  } catch (error) {
    console.error("Couldn't merge src/migrations/index.ts; left conflict markers instead.", error)
    try {
      execFileSync("git", [
        "merge-file",
        "-L",
        "ours",
        "-L",
        "base",
        "-L",
        "theirs",
        ours,
        base,
        theirs,
      ])
    } catch {
      // merge-file exits with the number of conflicts, which is the expected case here.
    }
    return 1
  }
}

/**
 * The command line, with the migrations folder as an argument so tests can point it
 * elsewhere. Returns the exit code.
 */
export async function main(args: readonly string[], dir = DIR): Promise<number> {
  if (args[0] === "--merge") return mergeIndexFiles(args[1]!, args[2]!, args[3]!)

  const index = join(dir, "index.ts")
  const expected = await renderMigrationsIndex(migrationFiles(readdirSync(dir)))
  if (readFileSync(index, "utf8") === expected) {
    console.warn("src/migrations/index.ts lists every migration, in order.")
    return 0
  }
  if (args.includes("--check")) {
    console.error(
      "src/migrations/index.ts doesn't list the migration files the way Payload writes it " +
        "(often a conflict resolved by hand). Run `pnpm migrate:index` and commit the result.",
    )
    return 1
  }
  writeFileSync(index, expected)
  console.warn("Rewrote src/migrations/index.ts.")
  return 0
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exitCode = await main(process.argv.slice(2))
}
