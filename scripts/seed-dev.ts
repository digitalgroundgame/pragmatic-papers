import "dotenv/config"
import { seed } from "@/endpoints/seed"
import config from "@payload-config"
import { getPayload } from "payload"

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"])

/**
 * Seeding deletes every article, volume, page and media file, and the npm
 * script runs Drizzle push first, so only a local database with local media
 * storage is a safe target. SEED_ALLOW_REMOTE=true opts out.
 */
export function assertLocalTarget(env: Record<string, string | undefined> = process.env): void {
  if (env.NODE_ENV === "production") {
    throw new Error("Seeding is not allowed in production")
  }
  if (env.SEED_ALLOW_REMOTE === "true") return

  const uri = env.DATABASE_URI
  const host = uri && URL.canParse(uri) ? new URL(uri).hostname : undefined
  if (!host || !LOCAL_HOSTS.has(host)) {
    throw new Error(
      `Refusing to seed ${host ? `the database at ${host}` : "without a valid DATABASE_URI"}: ` +
        "seeding wipes articles, volumes, pages and media. Point DATABASE_URI at the local " +
        "Docker Postgres, or set SEED_ALLOW_REMOTE=true if you really mean it.",
    )
  }
  if (env.USE_LOCAL_STORAGE !== "true") {
    throw new Error(
      "Refusing to seed without USE_LOCAL_STORAGE=true: seeding deletes every media file " +
        "from the configured storage bucket. Set USE_LOCAL_STORAGE=true, or " +
        "SEED_ALLOW_REMOTE=true if you really mean it.",
    )
  }
}

/**
 * Payload's schema push calls process.exit(0) when its data-loss prompt is
 * declined, which would otherwise read as a successful seed.
 */
export function failUnfinishedExit(finished: () => boolean): (code: number) => void {
  return (code) => {
    if (code === 0 && !finished()) {
      console.error("✘ Exited before seeding (was the schema push declined?)")
      process.exitCode = 1
    }
  }
}

export async function main(): Promise<void> {
  assertLocalTarget()

  const payload = await getPayload({ config })

  try {
    // revalidatePath/revalidateTag throw outside a Next.js request.
    await seed(
      payload,
      (message, step, total) => {
        console.warn(`[${step}/${total}] ${message}`)
      },
      { disableRevalidate: true },
    )
    console.warn("✔ Dev seed complete")
  } finally {
    await payload.db.destroy?.()
  }
}

if (!process.env.VITEST) {
  let finished = false
  process.once(
    "exit",
    failUnfinishedExit(() => finished),
  )
  try {
    await main()
    finished = true
    process.exit(0)
  } catch (err) {
    console.error(err)
    process.exit(1)
  }
}
