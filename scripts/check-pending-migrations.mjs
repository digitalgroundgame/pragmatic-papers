import { execSync } from "node:child_process"
import { blue, green, red } from "./ansi.mjs"
import { startTestDatabase } from "./test-db.mjs"

process.env.PAYLOAD_SECRET ||= "test-secret"
process.env.USE_LOCAL_STORAGE ||= "true"

let database = null

try {
  console.warn(`${blue("●")} Starting a test database for the migration check...`)
  // No snapshot: replaying every migration from scratch is what this checks.
  database = await startTestDatabase({
    migrate: (uri) => {
      console.warn(`${blue("●")} Running existing migrations...`)
      execSync("pnpm payload migrate", {
        env: { ...process.env, DATABASE_URI: uri },
        stdio: "inherit",
      })
    },
  })

  console.warn(`${blue("●")} Checking for pending schema changes...`)
  // This will attempt to create a migration. If it says "No schema changes detected", we are good.
  // We use "echo n" to answer "no" to the "Do you want to create a migration?" prompt if it appears.
  const output = execSync('echo "n" | pnpm payload migrate:create', {
    env: { ...process.env, DATABASE_URI: database.uri },
    encoding: "utf-8",
  })

  if (output.includes("No schema changes detected")) {
    console.warn(`${green("✔")} No pending migrations detected.`)
    process.exitCode = 0
  } else {
    console.error(
      `${red("✖")} Pending migrations detected! Please run 'pnpm payload migrate:create' locally and commit the result.`,
    )
    console.warn(output)
    process.exitCode = 1
  }
} catch (error) {
  console.error(`${red("✖")} Error during migration check: ${error.message}`)
  if (error.stdout) console.warn(error.stdout)
  if (error.stderr) console.error(error.stderr)
  process.exitCode = 1
} finally {
  if (database) {
    console.warn(`${blue("●")} Stopping the test database...`)
    database.stop()
  }
}
