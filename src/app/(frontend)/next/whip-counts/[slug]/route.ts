import { Locked } from "payload"

import { getPayloadClient } from "@/data/payload"
import { isExperimentEnabled } from "@/globals/SiteSettings/isExperimentEnabled"
import { WHIP_COUNT_PROFILE_ID } from "@/interactives/whip-count/profile"
import { mergePushedCount, parseWhipCount } from "@/interactives/whip-count/model"
import { whipCountSnapshotFields, whipCountSnapshotStamp } from "@/interactives/whip-count/snapshot"

import { hasBearer } from "../../bearer"

interface Args {
  params: Promise<{ slug: string }>
}

function logged(
  logger: { info: (message: string) => void },
  slug: string,
  published: boolean,
): Response {
  logger.info(
    `Whip count ${slug} took a pushed count, ${published ? "published" : "saved as a draft"}`,
  )
  return Response.json({ status: published ? "published" : "draft" })
}

/**
 * Takes a whip count from outside the admin, for whatever keeps one up to date (a scheduled
 * research job) so nobody has to paste it. The slug is a whip count interactive's (an
 * `interactives` document with the `whip-count` profile); the body is the count as the
 * snapshot's "Edit as JSON" takes it. It is checked like a save, then laid over the
 * snapshot's count, which keeps the blocs and tags its editors set (`mergePushedCount`).
 *
 * The first push creates the interactive's snapshot. Each one after is saved as a draft
 * version, so the public page changes only when an editor publishes it, unless the
 * interactive's feed is set to auto-publish. Even then it is saved as a draft while the
 * snapshot has unpublished edits: publishing starts from the newest version, so it would
 * publish their half-done work too. It never creates an interactive.
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
  // A draft interactive takes pushes too, so a count can be filled before it is published.
  const { docs: interactives } = await payload.find({
    collection: "interactives",
    draft: true,
    limit: 1,
    pagination: false,
    depth: 0,
    where: { slug: { equals: slug }, profile: { equals: WHIP_COUNT_PROFILE_ID } },
  })
  const interactive = interactives[0]
  if (!interactive) return Response.json({ error: "Not found" }, { status: 404 })
  const autoPublish = interactive.feed?.autoPublish === true
  const now = new Date()

  // The newest version, published or not: a draft an editor is working on is what to merge
  // into, and what the next push should be compared with.
  const { docs: snapshots } = await payload.find({
    collection: "interactive-snapshots",
    draft: true,
    limit: 1,
    pagination: false,
    depth: 0,
    where: { interactive: { equals: interactive.id } },
  })
  const snapshot = snapshots[0]

  if (!snapshot) {
    await payload.create({
      collection: "interactive-snapshots",
      draft: !autoPublish,
      data: {
        ...whipCountSnapshotFields(interactive, parsed.value, { source: "push", now }),
        _status: autoPublish ? "published" : "draft",
      },
    })
    return logged(payload.logger, slug, autoPublish)
  }

  const held = parseWhipCount(snapshot.data)
  const merged = mergePushedCount(held.success ? held.value : null, parsed.value)
  if (held.success && JSON.stringify(held.value) === JSON.stringify(merged)) {
    return Response.json({ status: "unchanged" })
  }

  // The newest version is a draft when an editor has saved changes since the last publish.
  const pendingEdits = snapshot._status === "draft"
  const publish = autoPublish && !pendingEdits
  try {
    await payload.update({
      collection: "interactive-snapshots",
      id: snapshot.id,
      draft: !publish,
      // An editor with the snapshot open would save their form's older count over the push.
      // Leave it to them: the next push lands once they close it.
      overrideLock: false,
      data: {
        // Spread into a plain object: the JSON field's type wants an index signature.
        data: { ...merged },
        sourceRef: "push",
        ...whipCountSnapshotStamp(merged, now),
        ...(publish ? { _status: "published" as const } : {}),
      },
    })
  } catch (err) {
    if (!(err instanceof Locked)) throw err
    return Response.json(
      { status: "locked", reason: "An editor has it open; the next push will try again." },
      { status: 409 },
    )
  }
  if (publish || !autoPublish) return logged(payload.logger, slug, publish)
  payload.logger.info(`Whip count ${slug} took a pushed count, saved as a draft`)
  return Response.json({
    status: "draft",
    reason: "An editor has unpublished changes; publish them together.",
  })
}
