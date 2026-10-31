import { blockDescriptor } from "@/blocks/registry"

import { isMediaId } from "./findMediaInBlocks"
import { SOURCES, type Source } from "./collectMediaReferences"

type Json = unknown

const REMOVE = Symbol("remove")

/** A field a reference names, checked against where media can actually be used. */
export interface DetachTarget {
  source: Source
  /** The field's path: "heroImage", "meta.image", or a rich text / blocks field. */
  field: string
  kind: "upload" | "blocks"
}

/**
 * Reads a reference's `field` ("heroImage", "content (mediaBlock, timeline)") back to
 * the field it names, and only if it is one `SOURCES` lists for that collection, so a
 * request can't clear an arbitrary field.
 */
export function resolveDetachTarget(collection: string, field: string): DetachTarget | undefined {
  const source = SOURCES.find((candidate) => candidate.collection === collection)
  if (!source) return undefined
  const base = field.split(" (")[0] ?? field
  if (source.fields.includes(base)) return { source, field: base, kind: "upload" }
  if (source.blockFields.includes(base)) return { source, field: base, kind: "blocks" }
  return undefined
}

/**
 * Removes `mediaId` from the blocks under `value`, which is rich text or a `blocks`
 * field, as each block's descriptor says (`media.detach` in `src/blocks/<Name>/index.ts`):
 * a media block that shows it is removed, a collage drops the image (and goes too if it
 * was the last one, since a collage needs an image), and a timeline event loses its
 * avatar. Returns the new value, or `undefined` if nothing used the media.
 */
export function detachFromBlocks(value: Json, mediaId: number | string): Json | undefined {
  let changed = false
  const uses = (media: unknown) => isMediaId(media, mediaId)

  const walk = (node: Json): Json => {
    if (Array.isArray(node)) {
      const kept: Json[] = []
      for (const item of node) {
        const next = walk(item)
        if (next !== REMOVE) kept.push(next)
      }
      return kept
    }
    if (!node || typeof node !== "object") return node

    const copy: Record<string, unknown> = {}
    for (const [key, child] of Object.entries(node)) {
      const next = walk(child)
      // A Lexical block node keeps its block in `fields`; if that goes, the node goes.
      if (next === REMOVE) return REMOVE
      copy[key] = next
    }

    const detach =
      typeof copy.blockType === "string"
        ? blockDescriptor(copy.blockType)?.media?.detach
        : undefined
    if (!detach) return copy
    const detached = detach(copy, uses)
    if (detached === copy) return copy
    changed = true
    return detached ?? REMOVE
  }

  const next = walk(value)
  return changed ? next : undefined
}

/**
 * The update that takes `mediaId` out of `target` on `doc`, or `undefined` if the
 * document doesn't use it there. A nested upload ("meta.image") is written with its
 * whole group, so the group's other fields keep their values.
 */
export function detachUpdate(
  doc: Record<string, unknown>,
  target: DetachTarget,
  mediaId: number | string,
): Record<string, unknown> | undefined {
  if (target.kind === "blocks") {
    const next = detachFromBlocks(doc[target.field], mediaId)
    return next === undefined ? undefined : { [target.field]: next }
  }

  const [group, key] = target.field.split(".")
  if (!group) return undefined
  if (key === undefined) {
    return isMediaId(doc[group], mediaId) ? { [group]: null } : undefined
  }
  const groupValue = (doc[group] ?? {}) as Record<string, unknown>
  return isMediaId(groupValue[key], mediaId)
    ? { [group]: { ...groupValue, [key]: null } }
    : undefined
}
