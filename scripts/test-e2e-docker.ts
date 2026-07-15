// Runs the E2E suite inside the same Playwright Docker image CI uses (see
// docker-compose.e2e.yml), so locally-generated screenshot baselines have
// parity with what CI produces — no more push-wait-auto-commit loop for
// routine baseline updates. See tests/e2e/README.md for the full lifecycle.
//
// Requires Docker with a running daemon (Docker Desktop is fine — no host
// networking or socket mounts involved). Postgres runs as a sibling compose
// service; the Next.js production server and Playwright run inside the
// pinned Playwright container.
//
// Usage:
//   pnpm test:e2e:update-snapshots                       # --update-snapshots=changed
//   pnpm test:e2e:update-snapshots -- --update-snapshots=missing
//   pnpm test:e2e:update-snapshots -- --update-snapshots=changed --project=chromium tests/e2e/foo.spec.ts

import { execSync, spawnSync } from "node:child_process"
import { yellow } from "./ansi.mjs"

const COMPOSE = ["docker", "compose", "-p", "pragmatic-papers-e2e", "-f", "docker-compose.e2e.yml"]

export function resolveArgs(argv: string[]): string[] {
  return argv.length > 0 ? argv : ["--update-snapshots=changed", "--project=chromium"]
}

export function missingFontTokenWarning(env: Record<string, string | undefined>): string | null {
  if (env.GH_FONT_READ) return null
  return [
    `${yellow("⚠")} GH_FONT_READ is not set — the private @digitalgroundgame/fonts package`,
    "  won't install, so screenshots will render with the fallback font and",
    "  WILL NOT match CI baselines. Export GH_FONT_READ before generating",
    "  baselines you intend to commit.",
  ].join("\n")
}

export function isDockerAvailable(): boolean {
  try {
    execSync("docker info", { stdio: "ignore" })
    return true
  } catch {
    return false
  }
}

export function main(): void {
  if (!isDockerAvailable()) {
    console.error("Docker daemon not reachable — start Docker and try again.")
    process.exit(1)
    return
  }

  const fontWarning = missingFontTokenWarning(process.env)
  if (fontWarning) console.error(fontWarning)

  const args = resolveArgs(process.argv.slice(2))

  try {
    const result = spawnSync(
      COMPOSE[0]!,
      [
        ...COMPOSE.slice(1),
        "run",
        "--rm",
        "playwright",
        "bash",
        "-c",
        'corepack enable && pnpm install --frozen-lockfile && node scripts/test-e2e.mjs "$@"',
        "bash",
        ...args,
      ],
      { stdio: "inherit" },
    )
    process.exitCode = result.status ?? 1
  } finally {
    spawnSync(COMPOSE[0]!, [...COMPOSE.slice(1), "down", "--remove-orphans"], { stdio: "ignore" })
  }
}

// CLI entry point — only runs when executed directly, not when imported.
/* v8 ignore next 3 */
if (process.argv[1] === import.meta.filename) {
  main()
}
