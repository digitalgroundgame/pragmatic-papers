import type { Endpoint, PayloadRequest } from "payload"

import { isEditor } from "@/access/checkRole"
import type { Volume } from "@/payload-types"
import { scheduleVolumeNewsletter } from "./logic"

/**
 * POST /api/volumes/:id/schedule-newsletter
 *
 * Editor-only. Synchronously runs the newsletter scheduling for this Volume,
 * which creates one daily Listmonk campaign per article. Idempotent — the
 * underlying function skips articles already scheduled (by campaign tag),
 * so clicking the button twice is safe.
 *
 * Requires the Volume to be published. The auto-on-publish hook was removed
 * in favor of this manual trigger because editors typically edit Volumes
 * for a day or two after publish before they're ready to send.
 */
export const scheduleNewsletterEndpoint: Endpoint = {
  path: "/:id/schedule-newsletter",
  method: "post",
  handler: async (req: PayloadRequest) => {
    if (!req.user || !isEditor(req.user)) {
      return Response.json({ error: "Unauthorized" }, { status: 401 })
    }

    const idParam = (req.routeParams as { id?: string } | undefined)?.id
    const volumeId = Number(idParam)
    if (!Number.isFinite(volumeId)) {
      return Response.json({ error: "Invalid volume id" }, { status: 400 })
    }

    const volume = (await req.payload.findByID({
      collection: "volumes",
      id: volumeId,
      overrideAccess: true,
      depth: 0,
    })) as Volume | null

    if (!volume) {
      return Response.json({ error: "Volume not found" }, { status: 404 })
    }
    if (volume._status !== "published") {
      return Response.json(
        { error: "Volume must be published before scheduling the newsletter." },
        { status: 400 },
      )
    }

    try {
      const { count } = await scheduleVolumeNewsletter(req.payload, volumeId)
      return Response.json({ count })
    } catch (err) {
      req.payload.logger.error({ err }, "[newsletter] schedule failed")
      const message = err instanceof Error ? err.message : "Unknown error"
      return Response.json({ error: `Failed to schedule newsletter: ${message}` }, { status: 500 })
    }
  },
}
