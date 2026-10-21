import type { Payload } from "payload"

import { buildSnapshot } from "@/blocks/SocialEmbed/helpers/buildSnapshot"
import { embedKey, type EmbedIdentity } from "@/blocks/SocialEmbed/helpers/embedKey"
import { newestSnapshot, shouldRevalidate } from "@/blocks/SocialEmbed/helpers/snapshotFreshness"
import type { SocialEmbedBlock, SocialEmbedSnapshot } from "@/payload-types"
import { isRecord } from "@/utilities/isRecord"

type Log = Pick<Payload["logger"], "info" | "warn" | "error">

export interface RefreshCounts {
  refreshed: number
  fresh: number
  failed: number
}

/** An embedded post, with the newest snapshot any article saved of it. */
interface Embed extends EmbedIdentity {
  snapshot: SocialEmbedSnapshot | undefined
}

function isSocialEmbed(fields: unknown): fields is SocialEmbedBlock {
  return (
    isRecord(fields) &&
    fields.blockType === "socialEmbed" &&
    typeof fields.url === "string" &&
    typeof fields.platform === "string"
  )
}

/** Every Social Embed block in a rich-text value, wherever it's nested. */
export function collectEmbeds(node: unknown, found: SocialEmbedBlock[] = []): SocialEmbedBlock[] {
  if (Array.isArray(node)) {
    for (const child of node) collectEmbeds(child, found)
    return found
  }
  if (!isRecord(node)) return found
  if (node.type === "block" && isSocialEmbed(node.fields)) found.push(node.fields)
  for (const [key, value] of Object.entries(node)) {
    if (key !== "parent" && (Array.isArray(value) || isRecord(value))) collectEmbeds(value, found)
  }
  return found
}

/** Published articles' embeds, one per `embedKey`. */
async function publishedEmbeds(payload: Payload): Promise<Map<string, Embed>> {
  const { docs } = await payload.find({
    collection: "articles",
    where: { _status: { equals: "published" } },
    draft: false,
    depth: 0,
    limit: 0,
    pagination: false,
    overrideAccess: true,
    select: { content: true },
  })
  const embeds = new Map<string, Embed>()
  for (const article of docs) {
    for (const block of collectEmbeds(article.content)) {
      const key = embedKey(block)
      const { platform, url, hideMedia, hideThread } = block
      const snapshot = newestSnapshot(embeds.get(key)?.snapshot, block.snapshot)
      embeds.set(key, { platform, url, hideMedia, hideThread, snapshot })
    }
  }
  return embeds
}

/**
 * Re-fetch every published embed whose newest snapshot (the article's, or the last refresh's)
 * is past its TTL, and keep the result in `embed-snapshots`. Articles are never written: the
 * page shows the newer snapshot when it next renders.
 */
export async function refreshEmbedSnapshots(
  payload: Payload,
  { log, build = buildSnapshot }: { log: Log; build?: typeof buildSnapshot },
): Promise<RefreshCounts> {
  const counts: RefreshCounts = { refreshed: 0, fresh: 0, failed: 0 }
  const embeds = await publishedEmbeds(payload)
  if (embeds.size === 0) return counts

  const { docs: rows } = await payload.find({
    collection: "embed-snapshots",
    where: { key: { in: [...embeds.keys()] } },
    depth: 0,
    limit: 0,
    pagination: false,
    overrideAccess: true,
  })
  const rowsByKey = new Map(rows.map((row) => [row.key, row]))

  for (const [key, embed] of embeds) {
    const row = rowsByKey.get(key)
    const current = newestSnapshot(embed.snapshot, row?.snapshot)
    if (!shouldRevalidate(current)) {
      counts.fresh += 1
      continue
    }
    try {
      const snapshot = await build({ ...embed, snapshot: current })
      const data = { key, ...embed, snapshot }
      if (row) {
        await payload.update({
          collection: "embed-snapshots",
          id: row.id,
          data,
          overrideAccess: true,
        })
      } else {
        await payload.create({ collection: "embed-snapshots", data, overrideAccess: true })
      }
      counts.refreshed += 1
      if (snapshot.status !== "ok") {
        log.info(`[embed-refresh] ${embed.url} is now ${snapshot.status}`)
      }
    } catch (err) {
      // One provider failing must not stop the rest.
      counts.failed += 1
      log.error(`[embed-refresh] ${embed.url}: ${err instanceof Error ? err.message : String(err)}`)
    }
  }
  return counts
}
