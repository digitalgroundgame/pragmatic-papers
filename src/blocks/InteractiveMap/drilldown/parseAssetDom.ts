import { buildDrilldownAsset, type SvgEvent } from "./parseAsset"
import type { DrilldownAsset } from "./types"

/**
 * Browser-side source for lazily fetched child assets.
 *
 * The raw file is never injected as markup. It is parsed into a detached document and
 * walked element by element, emitting the same event stream the server parser produces,
 * so only `<svg>`/`<g>`/`<path>`/`<metadata>` and the attributes the builder reads ever
 * influence what is rendered — a constructive allow-list, equivalent to running the
 * sanitizer, with no sanitizer shipped to the client.
 */
function* walk(node: Node): Generator<SvgEvent> {
  if (node.nodeType === Node.TEXT_NODE || node.nodeType === Node.CDATA_SECTION_NODE) {
    yield { type: "text", text: node.nodeValue ?? "" }
    return
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return
  const el = node as Element
  const attrs: Record<string, string> = {}
  for (const attr of Array.from(el.attributes)) attrs[attr.name] = attr.value
  const tag = el.localName.toLowerCase()
  yield { type: "open", tag, attrs }
  for (const child of Array.from(el.childNodes)) yield* walk(child)
  yield { type: "close", tag }
}

export class DrilldownAssetParseError extends Error {}

export function parseDrilldownAssetDocument(text: string): DrilldownAsset {
  const parser = new DOMParser()
  let root: Element | null = null

  const xml = parser.parseFromString(text, "image/svg+xml")
  if (!xml.getElementsByTagName("parsererror").length && xml.documentElement) {
    root = xml.documentElement
  } else {
    // Not well-formed XML (a hand-edited file, say). The HTML parser is forgiving; attribute
    // names come back lower-cased, which the builder's case-insensitive lookups absorb.
    const html = parser.parseFromString(text, "text/html")
    root = html.querySelector("svg")
  }
  if (!root || root.localName.toLowerCase() !== "svg") {
    throw new DrilldownAssetParseError("asset has no <svg> root")
  }
  return buildDrilldownAsset(walk(root))
}
