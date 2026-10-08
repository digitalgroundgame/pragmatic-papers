import { createHash, timingSafeEqual } from "node:crypto"
import { revalidatePath } from "next/cache"

function isBearer(header: string | null, secret: string): boolean {
  if (!header?.startsWith("Bearer ")) return false
  // Hashing first gives both sides the same length, which timingSafeEqual requires.
  const digest = (value: string) => createHash("sha256").update(value).digest()
  return timingSafeEqual(digest(header.slice("Bearer ".length)), digest(secret))
}

/**
 * Throws away every page and route Next.js prerendered at build time, so each
 * renders again from this deployment's database on its next request.
 *
 * An image built in CI is built against an empty database, so the
 * routes it bakes in (the RSS and Substack feeds) hold no content, and robots.txt and
 * the sitemap index name the build's host rather than this deployment's. An image
 * Coolify builds bakes in every article and volume as the database held them during
 * the build, which edits saved since never reach.
 * `dockerfiles/scripts/start.sh` calls this once the server is up, for both.
 *
 * Authenticated with `Authorization: Bearer <PAYLOAD_SECRET>`, which the
 * container already holds.
 */
export async function POST(request: Request): Promise<Response> {
  const secret = process.env.PAYLOAD_SECRET
  if (!secret || !isBearer(request.headers.get("authorization"), secret)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  revalidatePath("/", "layout")

  return Response.json({ revalidated: true })
}
