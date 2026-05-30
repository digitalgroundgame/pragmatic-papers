"use server"

import { buildSnapshot, type BuildSnapshotArgs } from "@/blocks/SocialEmbed/helpers/buildSnapshot"
import { SOCIAL_EMBED_SNAPSHOT_TTL_MS } from "@/blocks/SocialEmbed/helpers/snapshotFreshness"
import type { ParentDocContext } from "@/blocks/SocialEmbed/types"
import type { Article, SocialEmbedSnapshot } from "@/payload-types"
import configPromise from "@payload-config"
import { unstable_cache } from "next/cache"
import { getPayload } from "payload"

function getCachedSnapshotCheck(args: BuildSnapshotArgs): () => Promise<SocialEmbedSnapshot> {
  const revalidate = Math.ceil(SOCIAL_EMBED_SNAPSHOT_TTL_MS / 1000)
  return unstable_cache(
    async () => buildSnapshot(args),
    [
      "socialEmbedSnapshot",
      args.platform,
      args.url,
      String(!!args.hideMedia),
      String(!!args.hideThread),
    ],
    { revalidate },
  )
}

type LexicalNode = Record<string, unknown>

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function updateEmbedSnapshotInLexicalTree(
  node: unknown,
  embedBlockId: string,
  nextSnapshot: SocialEmbedSnapshot,
): { next: unknown; updated: boolean } {
  if (Array.isArray(node)) {
    let updated = false
    const nextArr = node.map((child) => {
      const res = updateEmbedSnapshotInLexicalTree(child, embedBlockId, nextSnapshot)
      if (res.updated) updated = true
      return res.next
    })
    return { next: updated ? nextArr : node, updated }
  }

  if (!isObject(node)) return { next: node, updated: false }

  // Detect payload lexical block nodes
  if (node.type === "block" && isObject(node.fields) && node.fields.id === embedBlockId) {
    const fields = node.fields as Record<string, unknown>
    return {
      next: { ...(node as LexicalNode), fields: { ...fields, snapshot: nextSnapshot } },
      updated: true,
    }
  }

  let didUpdate = false
  let clone: Record<string, unknown> | null = null

  for (const [key, value] of Object.entries(node)) {
    if (key === "parent") continue
    if (!(Array.isArray(value) || isObject(value))) continue

    const res = updateEmbedSnapshotInLexicalTree(value, embedBlockId, nextSnapshot)
    if (!res.updated) continue

    if (!clone) clone = { ...node }
    clone[key] = res.next as never
    didUpdate = true
  }

  return { next: clone ?? node, updated: didUpdate }
}

export interface RevalidateAndPersistArgs extends BuildSnapshotArgs {
  parentDoc: ParentDocContext
  embedBlockId: string
}

/**
 * Revalidates a social embed via oEmbed and persists the updated snapshot into the
 * parent article's lexical `content` by matching the block `fields.id`.
 *
 * Returns the refreshed snapshot (even if persistence could not occur).
 */
export async function revalidateSnapshot({
  parentDoc,
  embedBlockId,
  platform,
  url,
  snapshot = {},
  hideMedia,
  hideThread,
}: RevalidateAndPersistArgs): Promise<SocialEmbedSnapshot> {
  const check = getCachedSnapshotCheck({ platform, url, snapshot, hideMedia, hideThread })
  const checkSnapshot = await check()
  const nextSnapshot: SocialEmbedSnapshot = {
    ...snapshot,
    ...checkSnapshot,
  }

  const payload = await getPayload({ config: configPromise })
  const article = await payload.findByID({
    collection: parentDoc.collection,
    id: parentDoc.id,
    depth: 0,
    overrideAccess: true,
  })

  const res = updateEmbedSnapshotInLexicalTree(article.content, embedBlockId, nextSnapshot)
  if (!res.updated) return nextSnapshot

  await payload.update({
    collection: parentDoc.collection,
    id: parentDoc.id,
    overrideAccess: true,
    context: { disableRevalidate: true },
    data: {
      content: res.next as Article["content"],
    },
  })

  return nextSnapshot
}
