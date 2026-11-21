import { createHash } from "node:crypto"

import type { Payload, PayloadRequest } from "payload"

import type { InteractiveMapBlock, MapAsset, Media } from "@/payload-types"
import { isRecord } from "@/utilities/isRecord"
import { isResolved, relationshipId } from "@/utilities/relationships"

import { interactiveMapAlt, interactiveMapToSVG, type InteractiveMapWithImage } from "./converters"
import { renderMapImage } from "./renderImage"

/**
 * The map's picture for the Substack feed, which can't run the map: where it's kept and how
 * it's found again. Server-only (the feed's query and the hooks that draw the pictures).
 *
 * A picture is a Media upload named for a hash of what it was drawn from, the block's data
 * and its maps' SVG. So nothing records which picture belongs to which block: the feed hashes
 * the block it's about to render and looks the name up, an unchanged map is never drawn
 * twice, and a changed one gets a new picture while posts Substack already imported keep the
 * old one's URL.
 */

const NAME_PREFIX = "interactive-map-"
const NAME = /interactive-map-([0-9a-f]{16})/

/** Bump to redraw every map after a change to the drawing that old pictures shouldn't outlive. */
const DRAWING_VERSION = 1

/** Every Interactive Map block in a rich text value, as stored. */
export function mapBlocksIn(content: unknown): InteractiveMapWithImage[] {
  const found: InteractiveMapWithImage[] = []
  const visit = (node: unknown): void => {
    if (!isRecord(node)) return
    if (
      node.type === "block" &&
      isRecord(node.fields) &&
      node.fields.blockType === "interactiveMap"
    )
      found.push(node.fields as unknown as InteractiveMapWithImage)
    if (Array.isArray(node.children)) node.children.forEach(visit)
  }
  if (isRecord(content)) visit(content.root)
  return found
}

/**
 * What a block's picture is named for: a hash of everything the drawing reads. Null when
 * none of its maps has its SVG loaded, since there's nothing to draw.
 */
export function mapImageKey(block: InteractiveMapBlock): string | null {
  const maps = (block.maps ?? []).map((map) => [
    map.title ?? "",
    isResolved(map.svgAsset) ? (map.svgAsset.svgContent ?? "") : "",
    map.dataAttribute ?? "",
    Boolean(map.invertColors),
    (map.overrides ?? []).map((o) => [o.regionId, o.label ?? "", o.value ?? null, o.color ?? ""]),
  ])
  if (!maps.some(([, svg]) => svg)) return null
  const drawnFrom = [
    DRAWING_VERSION,
    block.widgetTitle ?? "",
    block.layout ?? "row",
    block.colorScale ?? "divergingRedBlue",
    block.colorBias ?? 1,
    maps,
  ]
  return createHash("sha256").update(JSON.stringify(drawnFrom)).digest("hex").slice(0, 16)
}

/** The stored pictures for these keys. Of two with one key (two saves at once), the older. */
async function findMapImages(payload: Payload, keys: string[]): Promise<Map<string, Media>> {
  const images = new Map<string, Media>()
  if (keys.length === 0) return images
  const { docs } = await payload.find({
    collection: "media",
    where: { or: keys.map((key) => ({ filename: { contains: NAME_PREFIX + key } })) },
    sort: "-createdAt",
    depth: 0,
    limit: 0,
    pagination: false,
    overrideAccess: true,
  })
  for (const media of docs) {
    const key = NAME.exec(media.filename ?? "")?.[1]
    if (key) images.set(key, media)
  }
  return images
}

/** The block with each map's asset as the document, where `assets` has it. */
function withAssets(block: InteractiveMapBlock, assets: Map<number, MapAsset>) {
  return {
    ...block,
    maps: (block.maps ?? []).map((map) => ({
      ...map,
      svgAsset: assets.get(relationshipId(map.svgAsset) ?? -1) ?? map.svgAsset,
    })),
  }
}

interface GenerateArgs {
  /** Map blocks as stored: their assets may be ids. */
  blocks: InteractiveMapBlock[]
  req: PayloadRequest
  /** Assets to use as given instead of loading them: one being saved, not yet committed. */
  assets?: MapAsset[]
}

/**
 * Draw and store the picture of each block that doesn't have one yet. A picture is stored
 * outside the request's transaction: it's right for its hash whether or not the save that
 * asked for it commits, and a failed upload can't then fail that save.
 */
export async function generateMapImages({ blocks, req, assets = [] }: GenerateArgs): Promise<void> {
  if (blocks.length === 0) return
  const { payload } = req

  const loaded = new Map(assets.map((asset) => [asset.id, asset]))
  const ids = blocks
    .flatMap((block) => (block.maps ?? []).map((map) => relationshipId(map.svgAsset)))
    .filter((id): id is number => id !== null && !loaded.has(id))
  if (ids.length > 0) {
    const { docs } = await payload.find({
      collection: "map-assets",
      where: { id: { in: [...new Set(ids)] } },
      depth: 0,
      limit: 0,
      pagination: false,
      overrideAccess: true,
      req,
    })
    for (const asset of docs) loaded.set(asset.id, asset)
  }

  const wanted = new Map<string, InteractiveMapBlock>()
  for (const block of blocks) {
    const resolved = withAssets(block, loaded)
    const key = mapImageKey(resolved)
    if (key) wanted.set(key, resolved)
  }
  const stored = await findMapImages(payload, [...wanted.keys()])

  for (const [key, block] of wanted) {
    if (stored.has(key)) continue
    const svg = interactiveMapToSVG(block)
    if (!svg) continue
    const data = await renderMapImage(svg)
    await payload.create({
      collection: "media",
      data: { alt: interactiveMapAlt(block) },
      file: {
        name: `${NAME_PREFIX}${key}.png`,
        data,
        mimetype: "image/png",
        size: data.byteLength,
      },
      user: req.user,
      overrideAccess: true,
      context: { disableRevalidate: true },
    })
  }
}

/**
 * Give each map block in these documents' `content` its stored picture, as `feedImage`, for
 * `interactiveMapToImage` to show. In memory only; the documents are the feed's own copies,
 * loaded deep enough that each map's asset is the document.
 */
export async function attachMapImages(
  payload: Payload,
  docs: { content?: unknown }[],
): Promise<void> {
  const keyed = docs
    .flatMap(({ content }) => mapBlocksIn(content))
    .map((block) => ({ block, key: mapImageKey(block) }))
  const keys = keyed.map(({ key }) => key).filter((key): key is string => key !== null)
  const images = await findMapImages(payload, [...new Set(keys)])
  for (const { block, key } of keyed) block.feedImage = (key && images.get(key)) || null
}
