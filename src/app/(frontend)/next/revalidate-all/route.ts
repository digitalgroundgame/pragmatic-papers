import { revalidatePath, revalidateTag } from "next/cache"

import { createMissingStarterPages } from "@/collections/Pages/starterPages"
import { readerAchievements } from "@/plugins/readerAchievements"
import { getPayloadClient } from "@/data/payload"

import { hasPayloadSecret } from "../bearer"

/**
 * Run once each time a deploy goes live. Creates any starter page the site doesn't have yet as a draft for
 * an editor to publish (`createMissingStarterPages`), creates the achievements a site starts
 * with, once per site (`readerAchievements.seed`; Early member goes to the members who signed
 * up before it), then throws away every page and route Next.js
 * prerendered at build time, so each renders again from that database on its next request.
 *
 * An image built in CI is built against an empty database, so the
 * routes it bakes in (the RSS and Substack feeds) hold no content, and robots.txt and
 * the sitemap index name the build's host rather than this deployment's. An image
 * Coolify builds bakes in every article and volume as the database held them during
 * the build, which edits saved since never reach.
 * `dockerfiles/scripts/start.sh` calls this once the server is up, for both, and the
 * Worker's deploy workflow once it has deployed.
 *
 * The Worker also gets this request after every editor save (`cloudflareWorkerCache`), marked
 * `?save`: that skips the starter pages and achievements, which are for a deploy. A save that says
 * what it revalidated (`?next`, with each `next-path` and `next-tag`) revalidates only those,
 * as the save did in Coolify's Next cache; any other throws away every page.
 *
 * Seeding happens on the Coolify app's deploy only. A Worker that reads the same database sets
 * `DEPLOY_SEED=false`, so its deploy only throws pages away: one seeder per database, or the
 * two deploys could each create the same starter content at once.
 *
 * Authenticated with `Authorization: Bearer <PAYLOAD_SECRET>`, which the
 * container already holds.
 */
export async function POST(request: Request): Promise<Response> {
  if (!hasPayloadSecret(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  if (searchParams.has("save")) {
    if (searchParams.has("next")) {
      const paths = searchParams.getAll("next-path").filter((path) => path.startsWith("/"))
      const tags = searchParams.getAll("next-tag")
      for (const path of paths) revalidatePath(path)
      for (const tag of tags) revalidateTag(tag, "max")
      return Response.json({ revalidated: true, paths, tags })
    }
    revalidatePath("/", "layout")
    return Response.json({ revalidated: true })
  }

  if (process.env.DEPLOY_SEED === "false") {
    revalidatePath("/", "layout")
    return Response.json({ revalidated: true, seeded: false })
  }

  const payload = await getPayloadClient()
  const pages = await createMissingStarterPages(payload)
  const achievements = await readerAchievements.seed(payload).catch((err: unknown) => {
    payload.logger.error({ err }, "Creating the starter achievements failed")
    return null
  })
  revalidatePath("/", "layout")

  return Response.json({
    revalidated: true,
    pages: { created: pages },
    achievements: { created: achievements },
  })
}
