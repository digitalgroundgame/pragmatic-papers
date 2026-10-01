import { type Volume } from "@/payload-types"
import { type CollectionAfterChangeHook } from "payload"
import { Volumes } from ".."

import { getServerSideURL } from "@/utilities/getURL"

export const pushToWebhooks: CollectionAfterChangeHook<Volume> = async (args) => {
  // NOTE: current check is supposed to filter for first publish
  if (
    args.previousDoc._status != "draft" ||
    args.doc._status != "published" ||
    args.previousDoc.publishedAt
  )
    return

  // The saved doc, not the request's `data`: a publish that sends only `_status` has no slug.
  const url = `${getServerSideURL()}/${Volumes.slug}/${args.doc.slug}`
  const { payload } = args.req
  const webhooks = await payload.find({ collection: "webhooks" })

  for (const webhook of webhooks.docs) {
    // Rows written before #672 carry the volume's ID as their own row ID; newer ones only the
    // volume number, since a row ID is unique across every webhook (see below).
    const hasBeenPushed = webhook.pushed?.some(
      (v) => v.volumeNumber === args.doc.volumeNumber || v.id === args.doc.id.toString(),
    )
    if (hasBeenPushed) continue

    const res = await fetch(webhook.url, {
      method: "post",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        content: url,
        username: "The Pragmatic Papers",
        avatar_url: `${getServerSideURL()}/android-chrome-192x192.png`,
      }),
    }).catch((e) => {
      console.error(e)
    })

    if (!res || !res.ok) {
      console.error(`Request to webhook ${webhook.name} failed`)
      if (res) console.error(`    ${res.status}: ${res.statusText}`)
      // One webhook failing is no reason to keep the volume from the others.
      continue
    }

    const volumesPushed = webhook.pushed ?? []
    // No `id`: array row IDs are primary keys shared by every webhook's rows, so reusing the
    // volume's ID made the second webhook's record collide with the first's.
    volumesPushed.push({
      volumeNumber: args.doc.volumeNumber,
      timePushed: new Date(Date.now()).toISOString(),
    })

    // Awaited, so the record exists once the publish returns, and caught, in a transaction of its
    // own, so failing to record a push that already went out never fails the publish itself.
    try {
      await payload.update({
        collection: "webhooks",
        id: webhook.id,
        data: {
          pushed: volumesPushed,
        },
      })
    } catch (error) {
      payload.logger.error({ err: error }, `Couldn't record the push to webhook ${webhook.name}`)
    }
  }
}
