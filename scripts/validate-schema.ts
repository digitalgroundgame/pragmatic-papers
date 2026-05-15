import { execSync } from "child_process"
import { migrations } from "../src/migrations/index.js"

function checkMigrationOrder(): boolean {
  let previous = ""
  let failed = false

  for (const migration of migrations) {
    const timestamp = migration.name.slice(0, 15)
    if (previous && timestamp < previous) {
      console.error(
        `ERROR: Migration '${migration.name}' is out of order — it comes after a migration with timestamp '${previous}' but has an earlier timestamp.`,
      )
      failed = true
    }
    previous = timestamp
  }

  if (!failed) {
    console.warn("✓ All migrations are in chronological order.")
  }
  return !failed
}

function checkPendingSchemaChanges(): boolean {
  let output: string
  try {
    output = execSync("pnpm migrate:create", {
      input: "n",
      encoding: "utf-8",
      timeout: 120_000,
    })
  } catch (error: unknown) {
    const err = error as ExecSyncError
    output = (err.stdout ?? "").toString() + (err.stderr ?? "").toString()
  }

  if (output.includes("No schema changes detected")) {
    console.warn("✓ No pending schema changes.")
    return true
  }

  console.error("ERROR: Pending schema changes detected.")
  console.error("Run `pnpm migrate:create` locally to create a migration for the changes.")
  return false
}

interface ExecSyncError {
  stdout?: Buffer | string
  stderr?: Buffer | string
}

const orderOk = checkMigrationOrder()
const schemaOk = checkPendingSchemaChanges()

if (!orderOk || !schemaOk) {
  process.exit(1)
}

console.warn("\n✓ All schema checks passed.")
