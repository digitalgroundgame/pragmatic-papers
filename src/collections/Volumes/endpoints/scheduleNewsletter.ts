import type { Endpoint, PayloadRequest } from "payload"

import { isEditor } from "@/access/checkRole"
import type { Volume } from "@/payload-types"

/**
 * POST /api/volumes/:id/schedule-newsletter
 *
 * Editor-only. Enqueues + runs the scheduleNewsletter job for this Volume,
 * which creates one daily Listmonk campaign per article. Idempotent — the
 * job skips days already scheduled, so clicking the button twice is safe.
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

    const job = await req.payload.jobs.queue({
      task: "scheduleNewsletter",
      input: { volumeId },
    })
    const result = await req.payload.jobs.run({ queue: "default", limit: 1 })

    // The job's output schema declares { count: number } — surface it to the UI.
    interface JobResult {
      jobStatus?: Record<string, { output?: { count?: number } }>
    }
    const jobResult = result as JobResult
    const count = jobResult.jobStatus?.[String(job.id)]?.output?.count

    return Response.json({ jobId: job.id, count })
  },
}
