import { getPayloadClient } from "@/data/payload"

import { hasPayloadSecret } from "../bearer"

/**
 * The names of the migrations this deployment's database has run, oldest first.
 *
 * The staging Worker's deploy (`.github/workflows/worker.yml`) waits until staging's
 * Coolify app reports the newest migration in the pushed commit, so the Worker never runs
 * against a schema older than its code. Coolify migrates while it builds, before the new
 * container starts, so this answers from the old container as soon as the migration ran.
 *
 * Authenticated with `Authorization: Bearer <PAYLOAD_SECRET>`, like `/next/revalidate-all`.
 */
export async function GET(request: Request): Promise<Response> {
  if (!hasPayloadSecret(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const payload = await getPayloadClient()
  const { docs } = await payload.find({
    collection: "payload-migrations",
    pagination: false,
    sort: "createdAt",
    select: { name: true },
  })

  return Response.json(
    { applied: docs.map((doc) => doc.name) },
    { headers: { "Cache-Control": "no-store" } },
  )
}
