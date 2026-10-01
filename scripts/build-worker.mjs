#!/usr/bin/env node
/**
 * #916 spike: builds the public site as a Cloudflare Worker with OpenNext.
 *
 *   node scripts/build-worker.mjs        # then: pnpm exec wrangler dev | wrangler deploy --dry-run
 *
 * - Webpack, not Turbopack: Turbopack copies the Payload config's module graph into
 *   each route group's chunks (2.4x), which put the Worker at ~20 MB gzipped against
 *   Cloudflare's 10 MiB limit. Webpack shares them: ~8.3 MB.
 * - Without `src/app/(payload)`: the admin panel and Payload's REST/GraphQL routes stay
 *   on Coolify, so the build moves the folder aside and puts it back afterwards.
 * - `OPENNEXT_BUILD=true` turns on the stubs and settings in next.config.ts.
 */
import { spawnSync } from "node:child_process"
import { existsSync, mkdirSync, renameSync } from "node:fs"
import path from "node:path"

const ADMIN = path.resolve("src/app/(payload)")
// Inside the repo (gitignored), so the move is a rename on the same filesystem.
const aside = path.resolve(".cache/worker-build/(payload)")

const run = (command, args, env = {}) => {
  const { status } = spawnSync(command, args, {
    stdio: "inherit",
    env: { ...process.env, OPENNEXT_BUILD: "true", ...env },
  })
  if (status !== 0) throw new Error(`${command} ${args.join(" ")} exited with ${status}`)
}

if (!existsSync(ADMIN)) throw new Error(`${ADMIN} is missing: is it at ${aside}?`)
mkdirSync(path.dirname(aside), { recursive: true })
renameSync(ADMIN, aside)
try {
  run("pnpm", ["exec", "next", "build", "--webpack"], {
    // Webpack needs more than Node's default heap for this app.
    NODE_OPTIONS: "--no-deprecation --max-old-space-size=12288",
  })
  run("pnpm", ["exec", "opennextjs-cloudflare", "build", "--skipNextBuild"])
} finally {
  renameSync(aside, ADMIN)
}
