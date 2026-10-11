// Registers this repo's git merge drivers in the clone's own config (`pnpm install`
// runs it as part of `prepare`). .gitattributes names a driver, but git only runs
// one its config defines; without it, git merges that file as plain text.
// Outside a git checkout (the Docker builds) it does nothing.
import { execFileSync } from "node:child_process"

const git = (...args) => execFileSync("git", args, { stdio: ["ignore", "pipe", "ignore"] })

try {
  git("rev-parse", "--git-dir")
} catch {
  process.exit(0)
}

git("config", "merge.migrations-index.name", "Rebuild src/migrations/index.ts from both sides")
git("config", "merge.migrations-index.driver", "node scripts/migrations-index.ts --merge %O %A %B")
