import { getPayloadClient } from "@/data/payload"
import { isExperimentEnabled } from "@/globals/SiteSettings/isExperimentEnabled"
import { mergePushedCount, parseWhipCount } from "@/interactives/whip-count/model"

import { hasBearer } from "../../bearer"

interface Args {
  params: Promise<{ slug: string }>
}

/**
 * Takes a whip count from outside the admin, for whatever keeps one up to date (a scheduled
 * research job) so nobody has to paste it. The body is the count as the admin's "Edit as
 * JSON" takes it. It is checked like a save, then laid over the document's own count, which
 * keeps the blocs and tags its editors set (`mergePushedCount`).
 *
 * The result is saved as a draft, so the public page changes only when an editor publishes
 * it, unless the document's "Publish pushed updates" is ticked. Even then it is saved as a draft
 * while an editor has unpublished changes: publishing starts from the newest version, so it
 * would publish their half-done work too (a title, a standfirst, rows). It never creates a
 * document.
 *
 * Authenticated with `Authorization: Bearer <WHIP_COUNT_PUSH_TOKEN>`: a token of its own, so
 * the job that holds it can change whip counts and nothing else. Closed while it is unset.
 */
export async function POST(request: Request, { params }: Args): Promise<Response> {
  if (!hasBearer(request, process.env.WHIP_COUNT_PUSH_TOKEN)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }
  if (!(await isExperimentEnabled("interactives"))) {
    return Response.json({ error: "Not found" }, { status: 404 })
  }

  const parsed = parseWhipCount(await request.json().catch(() => null))
  if (!parsed.success) return Response.json({ error: parsed.error }, { status: 400 })

  const { slug } = await params
  const payload = await getPayloadClient()
  // The newest version, published or not: a draft an editor is working on is what to merge
  // into, and what the next push should be compared with.
  const { docs } = await payload.find({
    collection: "whip-counts",
    draft: true,
    limit: 1,
    pagination: false,
    depth: 0,
    where: { slug: { equals: slug } },
  })
  const doc = docs[0]
  if (!doc) return Response.json({ error: "Not found" }, { status: 404 })

  const held = parseWhipCount(doc.data)
  const merged = mergePushedCount(held.success ? held.value : null, parsed.value)
  if (held.success && JSON.stringify(held.value) === JSON.stringify(merged)) {
    return Response.json({ status: "unchanged" })
  }

  // The newest version is a draft when an editor has saved changes since the last publish.
  const pendingEdits = doc._status === "draft"
  const publish = doc.autoPublish === true && !pendingEdits
  await payload.update({
    collection: "whip-counts",
    id: doc.id,
    draft: !publish,
    // Spread into a plain object: the JSON field's type wants an index signature.
    data: { data: { ...merged }, ...(publish ? { _status: "published" as const } : {}) },
  })
  payload.logger.info(
    `Whip count ${slug} took a pushed count, ${publish ? "published" : "saved as a draft"}`,
  )
  return Response.json(
    publish
      ? { status: "published" }
      : doc.autoPublish === true
        ? { status: "draft", reason: "An editor has unpublished changes; publish them together." }
        : { status: "draft" },
  )
}
