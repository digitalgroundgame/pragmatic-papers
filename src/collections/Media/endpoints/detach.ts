import type { CollectionSlug, PayloadRequest } from "payload"
import { isStaff } from "@/access/roles"
import { collectMediaReferences } from "../references/collectMediaReferences"
import { detachUpdate, resolveDetachTarget } from "../references/detach"
import { collectionLabel, fieldLabel } from "../references/labels"

interface DetachBody {
  collection?: unknown
  docId?: unknown
  field?: unknown
}

const fail = (status: number, error: string): Response => Response.json({ error }, { status })

/**
 * Takes a media item out of one field of one published document and publishes the
 * change, so the media can then be deleted. Every read and write runs as the
 * requesting user, so they can only detach from documents they could edit and publish
 * themselves.
 */
export async function detachHandler(req: PayloadRequest): Promise<Response> {
  const { payload, user } = req
  if (!user) return fail(401, "Unauthorized")
  if (!isStaff(user)) return fail(403, "Forbidden")

  const mediaId = parseInt(req.routeParams?.id as string, 10)
  if (isNaN(mediaId)) return fail(400, "Invalid ID")

  const body = ((await req.json?.().catch(() => undefined)) ?? {}) as DetachBody
  const { collection, docId, field } = body
  if (
    typeof collection !== "string" ||
    (typeof docId !== "string" && typeof docId !== "number") ||
    typeof field !== "string"
  ) {
    return fail(400, "Send the collection, docId and field of the reference to detach.")
  }
  const target = resolveDetachTarget(collection, field)
  if (!target) return fail(400, `Media can't be detached from ${collection} ${field}.`)

  const slug = collection as CollectionSlug
  const where = `${collectionLabel(collection).toLowerCase()} ${fieldLabel(field)}`

  try {
    if (target.source.drafts) {
      const latest = (await payload.findByID({
        collection: slug,
        id: docId,
        depth: 0,
        draft: true,
        overrideAccess: false,
        user,
      })) as unknown as { _status?: string }
      if (latest._status !== "published") {
        return fail(
          409,
          "This document has unpublished changes. Publish or discard them first, so detaching doesn't publish them too.",
        )
      }
    }

    const doc = (await payload.findByID({
      collection: slug,
      id: docId,
      depth: 0,
      overrideAccess: false,
      user,
    })) as unknown as Record<string, unknown>

    const update = detachUpdate(doc, target, mediaId)
    if (!update) {
      return fail(409, `The ${where} no longer uses this media.`)
    }

    await payload.update({
      collection: slug,
      id: docId,
      // Carries the request's flags (e.g. disableRevalidate) into the save's hooks.
      context: req.context,
      depth: 0,
      data: target.source.drafts ? { ...update, _status: "published" } : update,
      draft: false,
      overrideAccess: false,
      user,
    })
  } catch (error) {
    const status = (error as { status?: number }).status ?? 500
    if (status === 403) {
      return fail(
        403,
        `You don't have permission to edit and publish this ${collectionLabel(collection).toLowerCase()}.`,
      )
    }
    if (status === 404) return fail(404, "That document no longer exists.")
    if (status === 400) return fail(400, (error as Error).message)
    throw error
  }

  const references = await collectMediaReferences(payload, mediaId)
  const stillUsed = references.some(
    (ref) =>
      ref.collection === collection &&
      String(ref.docId) === String(docId) &&
      (ref.field.split(" (")[0] ?? ref.field) === target.field,
  )
  if (stillUsed) {
    // Saving filled the field back in, e.g. an article's SEO image from its hero image.
    return Response.json(
      {
        error: `Saving put the media back in the ${where}, filled in from another field. Detach that one first.`,
        references,
      },
      { status: 409 },
    )
  }

  return Response.json({ references })
}
