import { spawn, execSync } from "child_process"

const NODE_OPTIONS = "--no-deprecation"
const COMPOSE_PROJECT = "pragmatic-papers"
const COMPOSE_FILE = "docker-compose.yml"

function composeUp() {
  console.warn("[compose-lifecycle] Starting Docker...")
  execSync(
    `docker compose -p ${COMPOSE_PROJECT} -f ${COMPOSE_FILE} up -d`,
    { stdio: "inherit" },
  )
}

function composeDown() {
  console.warn("\n[compose-lifecycle] Stopping Docker...")
  execSync(
    `docker compose -p ${COMPOSE_PROJECT} -f ${COMPOSE_FILE} down`,
    { stdio: "inherit" },
  )
}

const args = process.argv.slice(2)
if (args.length === 0) {
  console.error("Usage: node scripts/compose-lifecycle.mjs <command> [args...]")
  process.exit(1)
}

composeUp()

const child = spawn(args[0], args.slice(1), {
  stdio: "inherit",
  env: { ...process.env, NODE_OPTIONS },
  shell: true,
})

let cleanedUp = false

function cleanup(exitCode) {
  if (cleanedUp) return
  cleanedUp = true
  composeDown()
  process.exit(exitCode ?? 0)
}

process.on("SIGINT", () => cleanup(130))
process.on("SIGTERM", () => cleanup(143))

child.on("exit", (code) => cleanup(code ?? 0))
child.on("error", () => cleanup(1))
