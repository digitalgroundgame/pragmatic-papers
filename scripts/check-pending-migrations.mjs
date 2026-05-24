import { PostgreSqlContainer } from "@testcontainers/postgresql"
import { execSync } from "node:child_process"
import { blue, green, red } from "./ansi.mjs"

console.warn(`${blue("●")} Starting Postgres container for migration check...`)
const container = await new PostgreSqlContainer("postgres:15-alpine")
  .withDatabase("pragmatic-papers-test")
  .start()

const uri = container.getConnectionUri()
process.env.DATABASE_URI = uri
process.env.PAYLOAD_SECRET ??= "test-secret"
process.env.USE_LOCAL_STORAGE ??= "true"

console.warn(`${green("✔")} Test database started at ${uri}`)

try {
  console.warn(`${blue("●")} Running existing migrations...`)
  execSync("pnpm payload migrate", {
    env: process.env,
    stdio: "inherit",
  })

  console.warn(`${blue("●")} Checking for pending schema changes...`)
  // This will attempt to create a migration. If it says "No schema changes detected", we are good.
  // We use "echo n" to answer "no" to the "Do you want to create a migration?" prompt if it appears.
  const output = execSync('echo "n" | pnpm payload migrate:create', {
    env: process.env,
    encoding: "utf-8",
  })

  if (output.includes("No schema changes detected")) {
    console.warn(`${green("✔")} No pending migrations detected.`)
    process.exit(0)
  } else {
    console.error(
      `${red("✖")} Pending migrations detected! Please run 'pnpm payload migrate:create' locally and commit the result.`,
    )
    console.warn(output)
    process.exit(1)
  }
} catch (error) {
  console.error(`${red("✖")} Error during migration check: ${error.message}`)
  if (error.stdout) console.warn(error.stdout)
  if (error.stderr) console.error(error.stderr)
  process.exit(1)
} finally {
  console.warn(`${blue("●")} Stopping Postgres container...`)
  await container.stop()
}
