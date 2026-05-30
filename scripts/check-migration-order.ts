import { migrations } from "../src/migrations/index.js"

let previous = ""
let failed = false

for (const migration of migrations) {
  const timestamp = migration.name.slice(0, 15) // YYYYMMDD_HHMMSS
  if (previous && timestamp < previous) {
    console.error(
      `ERROR: Migration '${migration.name}' is out of order — it comes after a migration with timestamp '${previous}' but has an earlier timestamp.`,
    )
    failed = true
  }
  previous = timestamp
}

if (failed) {
  process.exit(1)
} else {
  console.warn("All migrations are in chronological order.")
}
