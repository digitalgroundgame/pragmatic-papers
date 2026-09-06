import { Parser } from "htmlparser2"

import { validateDrilldownPayload } from "./contract"
import { factKey, isReservedFact, RESERVED_FACTS } from "./contract"
import type { DrilldownAsset, DrilldownPath, FactMap, ViewBox } from "./types"

type SvgEvent =
  | { type: "open"; tag: string; attrs: Record<string, string> }
  | { type: "close"; tag: string }

function lookup(attrs: Record<string, string>, name: string): string | undefined {
  if (name in attrs) return attrs[name]
  const lower = name.toLowerCase()
  for (const [k, v] of Object.entries(attrs)) if (k.toLowerCase() === lower) return v
  return undefined
}

export function parseViewBox(value: string | undefined | null): ViewBox | null {
  if (!value) return null
  const parts = value
    .trim()
    .split(/[\s,]+/)
    .map(Number)
  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) return null
  const [x, y, w, h] = parts as [number, number, number, number]
  if (w <= 0 || h <= 0) return null
  return [x, y, w, h]
}

const FLIP_RE = /scale\(\s*1\s*,\s*-1\s*\)/

function pathFromAttrs(attrs: Record<string, string>): DrilldownPath | null {
  const d = lookup(attrs, "d")
  if (!d) return null
  const facts: FactMap = {}
  let label: string | null = null
  let parentId: string | null = null
  let layer: string | null = null
  let inset = false
  for (const [rawKey, value] of Object.entries(attrs)) {
    const lower = rawKey.toLowerCase()
    if (!lower.startsWith("data-")) continue
    const key = factKey(lower)
    if (key === RESERVED_FACTS.label) label = value.trim() || null
    else if (key === RESERVED_FACTS.parentId) parentId = value.trim() || null
    else if (key === RESERVED_FACTS.layer) layer = value.trim() || null
    else if (key === RESERVED_FACTS.inset) inset = value.trim().toLowerCase() === "true"
    else facts[key] = value
  }
  const id = lookup(attrs, "id")?.trim() || null
  return { id, d, layer, parentId, inset, label, facts }
}

function buildGeometryAsset(events: Iterable<SvgEvent>): DrilldownAsset {
  let viewBox: ViewBox | null = null
  let flipY = false
  let sawFirstGroup = false
  let svgDepth = 0
  const paths: DrilldownPath[] = []

  for (const ev of events) {
    if (ev.type === "open") {
      const tag = ev.tag.toLowerCase()
      if (tag === "svg") {
        svgDepth += 1
        if (viewBox === null) viewBox = parseViewBox(lookup(ev.attrs, "viewBox"))
        continue
      }
      if (svgDepth === 0) continue
      if (tag === "g" && !sawFirstGroup) {
        sawFirstGroup = true
        flipY = FLIP_RE.test(lookup(ev.attrs, "transform") ?? "")
      } else if (tag === "path") {
        const p = pathFromAttrs(ev.attrs)
        if (p) paths.push(p)
      }
    } else if (ev.tag.toLowerCase() === "svg") {
      svgDepth = Math.max(0, svgDepth - 1)
    }
  }

  return { viewBox, flipY, paths, payload: null, payloadError: null }
}

/**
 * Geometry out of an exported SVG: shapes, ids, hierarchy and the `data-*` attributes that
 * describe them. Runs at snapshot time (`src/interactives/geometry.ts`), never at render time
 * and never in the browser — facts and records reach the engine from a feed, not from a file.
 */
export function parseDrilldownAssetString(sanitizedSvg: string): DrilldownAsset {
  const events: SvgEvent[] = []
  const parser = new Parser(
    {
      onopentag(name, attrs) {
        events.push({ type: "open", tag: name, attrs: { ...attrs } })
      },
      onclosetag(name) {
        events.push({ type: "close", tag: name })
      },
    },
    { xmlMode: false, lowerCaseTags: true, lowerCaseAttributeNames: false, decodeEntities: true },
  )
  parser.write(sanitizedSvg)
  parser.end()
  return buildGeometryAsset(events)
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v)
const str = (v: unknown): string | null => (typeof v === "string" && v ? v : null)

/**
 * The wire format the client reads: an asset already composed on the server
 * (`src/interactives/compose.ts`) and served as JSON. The shape is ours, so this is a guard
 * rather than a parser — a wrong field degrades to an empty path or a null payload with a
 * readable `payloadError`, never a throw inside the drill-in.
 */
export function parseDrilldownAssetJson(value: unknown): DrilldownAsset {
  if (!isRecord(value)) {
    return {
      viewBox: null,
      flipY: false,
      paths: [],
      payload: null,
      payloadError: "asset is not an object",
    }
  }
  const vb = value.viewBox
  const viewBox =
    Array.isArray(vb) &&
    vb.length === 4 &&
    vb.every((n) => typeof n === "number" && Number.isFinite(n))
      ? (vb as ViewBox)
      : null
  const paths: DrilldownPath[] = []
  if (Array.isArray(value.paths)) {
    for (const p of value.paths) {
      if (!isRecord(p) || typeof p.d !== "string") continue
      const facts: FactMap = {}
      if (isRecord(p.facts))
        for (const [k, v] of Object.entries(p.facts))
          if (typeof v === "string") facts[factKey(k)] = v
      paths.push({
        id: str(p.id),
        d: p.d,
        layer: str(p.layer),
        parentId: str(p.parentId),
        inset: p.inset === true,
        label: str(p.label),
        facts,
      })
    }
  }
  let payload: DrilldownAsset["payload"] = null
  let payloadError: string | null = null
  if (value.payload !== null && value.payload !== undefined) {
    const result = validateDrilldownPayload(value.payload)
    payload = result.payload
    if (result.errors.length > 0) payloadError = result.errors.join("; ")
  }
  return { viewBox, flipY: value.flipY === true, paths, payload, payloadError }
}

export { isReservedFact }
