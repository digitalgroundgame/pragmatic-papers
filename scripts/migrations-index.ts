// Writes src/migrations/index.ts from the migration files beside it, in
// timestamp order: one import and one one-line entry per
// `<timestamp>_<name>.ts`. Every new migration appends to that file, so two
// branches that each add one conflict there; .gitattributes merges it with
// `union`, which keeps both sides' lines, and this puts them back in order.
// `payload migrate:create` writes the file in its own shape, so
// `postmigrate:create` runs this after it. `--check` fails, naming the fix, when the file
// isn't what this would write (CI's Static checks run it).
//
//   pnpm migrate:index          rewrite the index
//   pnpm migrate:index --check  only compare
import { readdirSync, readFileSync, writeFileSync } from "node:fs"
import { fileURLToPath } from "node:url"

const DIR = fileURLToPath(new URL("../src/migrations/", import.meta.url))
const INDEX = `${DIR}index.ts`

export function buildMigrationsIndex(files: readonly string[]): string {
  const names = files
    .filter((file) => /^\d{8}_\d{6}_.+\.ts$/.test(file))
    .map((file) => file.slice(0, -".ts".length))
    .sort()
  const imports = names.map((name) => `import * as migration_${name} from "./${name}"`)
  // One line per migration, so a union merge of two branches keeps both whole.
  const entries = names.map((name) => `  "${name}": migration_${name},`)
  return [
    ...imports,
    "",
    "// Written by scripts/migrations-index.ts (`pnpm migrate:index`), in timestamp order.",
    "const MIGRATIONS = {",
    ...entries,
    "}",
    "",
    "export const migrations = Object.entries(MIGRATIONS).map(([name, migration]) => ({",
    "  up: migration.up,",
    "  down: migration.down,",
    "  name,",
    "}))",
    "",
  ].join("\n")
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const expected = buildMigrationsIndex(readdirSync(DIR))
  const actual = readFileSync(INDEX, "utf8")
  if (actual === expected) {
    console.warn("src/migrations/index.ts lists every migration, in order.")
  } else if (process.argv.includes("--check")) {
    console.error(
      "src/migrations/index.ts doesn't list the migration files in timestamp order " +
        "(often a merge that kept both sides). Run `pnpm migrate:index` and commit the result.",
    )
    process.exit(1)
  } else {
    writeFileSync(INDEX, expected)
    console.warn("Rewrote src/migrations/index.ts.")
  }
}
