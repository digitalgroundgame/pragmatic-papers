import { type Volume } from "@/payload-types"
import config from "@payload-config"
import { getPayload, type CollectionAfterChangeHook } from "payload"
import { env } from "process"
import { Volumes } from ".."

export const pushToWebhooks: CollectionAfterChangeHook<Volume> = async (args) => {
  // NOTE: current check is supposed to filter for first publish
  if (
    args.previousDoc._status != "draft" ||
    args.doc._status != "published" ||
    args.previousDoc.publishedAt
  )
    return

  const url = `${env.NEXT_PUBLIC_SERVER_URL}/${Volumes.slug}/${args.data.slug}`
  const payload = await getPayload({ config })
  const webhooks = await payload.find({ collection: "webhooks" })

  for (const webhook of webhooks.docs) {
    const hasBeenPushed = webhook.pushed?.map((v) => v.id).includes(args.doc.id.toString())
    if (hasBeenPushed) continue

    const res = await fetch(webhook.url, {
      method: "post",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        content: url,
        username: "The Pragmatic Papers",
        avatar_url: `${env.NEXT_PUBLIC_SERVER_URL}/android-chrome-192x192.png`,
      }),
    }).catch((e) => {
      console.error(e)
    })

    if (!res || !res.ok) {
      console.error(`Request to webhook ${webhook.name} failed`)
      if (res) console.error(`    ${res.status}: ${res.statusText}`)
      return
    }

    const volumesPushed = webhook.pushed ?? []
    volumesPushed.push({
      volumeNumber: args.doc.volumeNumber,
      timePushed: new Date(Date.now()).toISOString(),
      id: args.doc.id.toString(),
    })

    payload.update({
      collection: "webhooks",
      id: webhook.id,
      data: {
        pushed: volumesPushed,
      },
    })
  }
}
