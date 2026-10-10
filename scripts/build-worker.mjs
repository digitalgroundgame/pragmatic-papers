#!/usr/bin/env node
/**
 * Builds the public site as a Cloudflare Worker with OpenNext (`pnpm build:worker`), into
 * `.open-next/`. See src/cloudflare/README.md.
 *
 * - Webpack, not Turbopack: Turbopack copies the Payload config's module graph into each
 *   route group's chunks (2.4x), which puts the Worker far over Cloudflare's 10 MiB limit.
 * - Without `src/app/(payload)`: the admin panel and Payload's REST/GraphQL routes stay on
 *   Coolify, so the build moves the folder aside and puts it back afterwards. If a build
 *   is killed before it can, the next run puts it back first.
 * - `OPENNEXT_BUILD=true` turns on `withCloudflare` in next.config.ts.
 * - The static assets' headers (`src/cloudflare/_headers`) go into `.open-next/assets`.
 */
import { spawnSync } from "node:child_process"
import { copyFileSync, existsSync, mkdirSync, renameSync } from "node:fs"
import path from "node:path"

const ADMIN = path.resolve("src/app/(payload)")
// Inside the repo (gitignored), so the move is a rename on the same filesystem.
const ASIDE = path.resolve(".cache/worker-build/(payload)")

const restore = () => {
  if (existsSync(ASIDE) && !existsSync(ADMIN)) renameSync(ASIDE, ADMIN)
}

const run = (command, args, env = {}) => {
  const { status, signal } = spawnSync(command, args, {
    stdio: "inherit",
    env: { ...process.env, OPENNEXT_BUILD: "true", ...env },
  })
  if (status !== 0) throw new Error(`${command} ${args.join(" ")} exited with ${signal ?? status}`)
}

restore()
if (!existsSync(ADMIN)) throw new Error(`${ADMIN} is missing`)
mkdirSync(path.dirname(ASIDE), { recursive: true })
renameSync(ADMIN, ASIDE)
// Ctrl-C reaches the build too; let it stop, then put the folder back below.
const outliveTheBuild = () => undefined
process.on("SIGINT", outliveTheBuild)
process.on("SIGTERM", outliveTheBuild)
try {
  run("pnpm", ["exec", "next", "build", "--webpack"], {
    // Webpack needs more than Node's default heap for this app.
    NODE_OPTIONS: "--no-deprecation --max-old-space-size=12288",
  })
  run("pnpm", ["exec", "opennextjs-cloudflare", "build", "--skipNextBuild"])
  copyFileSync("src/cloudflare/_headers", ".open-next/assets/_headers")
} finally {
  restore()
}
