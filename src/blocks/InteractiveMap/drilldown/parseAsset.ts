import { Parser } from "htmlparser2"

import { validateDrilldownPayload } from "./contract"
import { factKey, isReservedFact, RESERVED_FACTS } from "./contract"
import type { DrilldownAsset, DrilldownPath, FactMap, ViewBox } from "./types"

/**
 * Both parsers — htmlparser2 on the server, DOMParser in the browser — reduce an SVG to
 * this one event stream, and `buildDrilldownAsset` does the rest. One set of extraction
 * rules, so the overview (parsed at render time) and the child assets (parsed after a
 * lazy fetch) can never disagree about what a path means.
 */
export type SvgEvent =
  | { type: "open"; tag: string; attrs: Record<string, string> }
  | { type: "text"; text: string }
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

export function buildDrilldownAsset(events: Iterable<SvgEvent>): DrilldownAsset {
  let viewBox: ViewBox | null = null
  let flipY = false
  let sawFirstGroup = false
  let svgDepth = 0
  let metadataDepth = 0
  let metadataDone = false
  const metadataChunks: string[] = []
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
      } else if (tag === "metadata") {
        if (!metadataDone) metadataDepth += 1
      } else if (tag === "path") {
        const p = pathFromAttrs(ev.attrs)
        if (p) paths.push(p)
      }
    } else if (ev.type === "text") {
      if (metadataDepth > 0 && !metadataDone) metadataChunks.push(ev.text)
    } else {
      const tag = ev.tag.toLowerCase()
      if (tag === "svg") svgDepth = Math.max(0, svgDepth - 1)
      else if (tag === "metadata" && metadataDepth > 0) {
        metadataDepth -= 1
        if (metadataDepth === 0) metadataDone = true
      }
    }
  }

  let payload: DrilldownAsset["payload"] = null
  let payloadError: string | null = null
  const metadataText = metadataChunks.join("").trim()
  if (metadataText) {
    let json: unknown
    try {
      json = JSON.parse(metadataText)
    } catch (err) {
      payloadError = `<metadata> is not valid JSON: ${err instanceof Error ? err.message : String(err)}`
    }
    if (json !== undefined) {
      const result = validateDrilldownPayload(json)
      payload = result.payload
      if (result.errors.length > 0) payloadError = result.errors.join("; ")
    }
  }

  return { viewBox, flipY, paths, payload, payloadError }
}

/**
 * Server-side source: htmlparser2 over the already-sanitized SVG string. Entities in
 * attribute values and in the `<metadata>` text are decoded by the parser.
 */
export function parseDrilldownAssetString(sanitizedSvg: string): DrilldownAsset {
  const events: SvgEvent[] = []
  const parser = new Parser(
    {
      onopentag(name, attrs) {
        events.push({ type: "open", tag: name, attrs: { ...attrs } })
      },
      ontext(text) {
        events.push({ type: "text", text })
      },
      onclosetag(name) {
        events.push({ type: "close", tag: name })
      },
    },
    { xmlMode: false, lowerCaseTags: true, lowerCaseAttributeNames: false, decodeEntities: true },
  )
  parser.write(sanitizedSvg)
  parser.end()
  return buildDrilldownAsset(events)
}

export { isReservedFact }
