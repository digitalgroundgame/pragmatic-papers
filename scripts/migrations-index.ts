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

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2)
  if (args[0] === "--merge") {
    const [base, ours, theirs] = args
      .slice(1)
      .map((file) => listedMigrations(readFileSync(file!, "utf8")))
    writeFileSync(args[2]!, await renderMigrationsIndex(mergeMigrations(base!, ours!, theirs!)))
  } else {
    const expected = await renderMigrationsIndex(migrationFiles(readdirSync(DIR)))
    if (readFileSync(INDEX, "utf8") === expected) {
      console.warn("src/migrations/index.ts lists every migration, in order.")
    } else if (args.includes("--check")) {
      console.error(
        "src/migrations/index.ts doesn't list the migration files the way Payload writes it " +
          "(often a conflict resolved by hand). Run `pnpm migrate:index` and commit the result.",
      )
      process.exit(1)
    } else {
      writeFileSync(INDEX, expected)
      console.warn("Rewrote src/migrations/index.ts.")
    }
  }
}
