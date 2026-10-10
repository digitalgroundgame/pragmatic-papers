// jsonld is CommonJS with no static named exports, so Node only offers its default.
import jsonld from "jsonld"
import type { RemoteDocument } from "jsonld/jsonld-spec"

/**
 * Checks for the JSON-LD a page renders through `<JsonLd>`. Pure functions over
 * parsed JSON, so structured-data.spec.ts can run them on what the browser
 * actually received rather than on the builders' return values.
 */

type Json = string | number | boolean | null | Json[] | { [key: string]: Json }
interface JsonNode {
  [key: string]: Json
}

const SCHEMA_CONTEXT = "https://schema.org"

/**
 * Stands in for schema.org's published context, which E2E can't fetch (it runs
 * offline). Every schema.org term is the vocabulary's IRI plus the term, which
 * is what `@vocab` says; the published context adds type coercions on top that
 * don't change whether a document expands. Any other remote context fails the
 * test, since nothing we render should need one.
 */
async function documentLoader(url: string): Promise<RemoteDocument> {
  if (url.replace(/\/$/, "") === SCHEMA_CONTEXT || url === "http://schema.org") {
    return {
      contextUrl: undefined,
      documentUrl: url,
      document: { "@context": { "@vocab": "https://schema.org/" } },
    }
  }
  throw new Error(`JSON-LD tried to load a remote document: ${url}`)
}

/**
 * Expands a block in jsonld.js's safe mode, which throws on anything a JSON-LD
 * processor would drop or misread (a malformed `@id`, a keyword in the wrong
 * place, an `@type` that isn't an IRI) instead of silently discarding it.
 */
export async function expandJsonLd(block: unknown): Promise<unknown[]> {
  // jsonld's options type predates safe mode.
  return jsonld.expand(
    block as object,
    {
      documentLoader,
      safe: true,
    } as Parameters<typeof jsonld.expand>[1],
  )
}

/** The nodes a block describes: its `@graph`, or the block itself. */
export function topLevelNodes(block: JsonNode): JsonNode[] {
  const graph = block["@graph"]
  if (Array.isArray(graph)) return graph as JsonNode[]
  return [block]
}

/** Every `@type` a block's top-level nodes declare, in order. */
export function topLevelTypes(blocks: JsonNode[]): string[] {
  return blocks.flatMap(topLevelNodes).map((node) => String(node["@type"]))
}

function isNonEmptyString(value: Json | undefined): value is string {
  return typeof value === "string" && value.trim().length > 0
}

function isAbsoluteUrl(value: Json | undefined): boolean {
  if (typeof value !== "string") return false
  try {
    const { protocol } = new URL(value)
    return protocol === "http:" || protocol === "https:"
  } catch {
    return false
  }
}

function asArray(value: Json | undefined): Json[] {
  if (value === undefined) return []
  return Array.isArray(value) ? value : [value]
}

function label(node: JsonNode): string {
  const id = node["@id"] ? ` ${String(node["@id"])}` : ""
  return `${String(node["@type"])}${id}`
}

/**
 * A field that's present but empty: `null`, `""` or `[]`. The builders map
 * empty CMS values to `undefined`, which `JSON.stringify` drops; anything else
 * reaching the page means a builder passed one through.
 */
function findEmptyValues(value: Json, path: string, problems: string[]): void {
  if (value === null || (typeof value === "string" && value.trim() === "")) {
    problems.push(`${path} is empty`)
  } else if (Array.isArray(value)) {
    if (value.length === 0) problems.push(`${path} is an empty list`)
    value.forEach((item, i) => findEmptyValues(item, `${path}[${i}]`, problems))
  } else if (typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      findEmptyValues(child, `${path}.${key}`, problems)
    }
  }
}

type Rule = (node: JsonNode, problems: string[]) => void

function requireName(node: JsonNode, problems: string[]): void {
  if (!isNonEmptyString(node.name)) problems.push(`${label(node)} has no name`)
}

function requireUrl(node: JsonNode, problems: string[]): void {
  if (!isAbsoluteUrl(node.url)) problems.push(`${label(node)} has no absolute url`)
}

/**
 * What each type we render must carry: Google's required properties for its
 * rich result, plus the ones it recommends that we always have data for.
 * A type with no rule fails, so a new builder gets one.
 */
const RULES: Record<string, Rule> = {
  NewsArticle(node, problems) {
    // Google truncates longer headlines in rich results.
    if (!isNonEmptyString(node.headline)) problems.push(`${label(node)} has no headline`)
    else if (node.headline.length > 110)
      problems.push(`${label(node)} headline is over 110 characters`)

    for (const key of ["datePublished", "dateModified"] as const) {
      const value = node[key]
      if (typeof value !== "string" || Number.isNaN(Date.parse(value)))
        problems.push(`${label(node)} ${key} is not an ISO 8601 date`)
    }

    const authors = asArray(node.author)
    if (authors.length === 0) problems.push(`${label(node)} has no author`)
    for (const author of authors) {
      if (typeof author !== "object" || author === null || Array.isArray(author)) {
        problems.push(`${label(node)} author is not a node`)
        continue
      }
      requireName(author, problems)
      requireUrl(author, problems)
    }

    // Google only recommends it, but every article we publish has one, and an
    // article card in search results looks broken without it.
    const images = asArray(node.image)
    if (images.length === 0) problems.push(`${label(node)} has no image`)
    for (const image of images) {
      if (!isAbsoluteUrl(image)) problems.push(`${label(node)} image is not an absolute URL`)
    }
  },
  BreadcrumbList(node, problems) {
    const items = asArray(node.itemListElement)
    if (items.length === 0) problems.push(`${label(node)} has no items`)
    items.forEach((item, i) => {
      if (typeof item !== "object" || item === null || Array.isArray(item)) {
        problems.push(`${label(node)} item ${i + 1} is not a node`)
        return
      }
      if (item["@type"] !== "ListItem") problems.push(`breadcrumb ${i + 1} is not a ListItem`)
      if (item.position !== i + 1)
        problems.push(`breadcrumb ${i + 1} has position ${JSON.stringify(item.position)}`)
      if (!isNonEmptyString(item.name)) problems.push(`breadcrumb ${i + 1} has no name`)
      if (!isAbsoluteUrl(item.item)) problems.push(`breadcrumb ${i + 1} has no absolute item URL`)
    })
  },
  Person(node, problems) {
    requireName(node, problems)
    requireUrl(node, problems)
  },
  PublicationVolume(node, problems) {
    requireName(node, problems)
    requireUrl(node, problems)
  },
  Organization(node, problems) {
    requireName(node, problems)
    requireUrl(node, problems)
    const logo = node.logo
    const logoUrl = typeof logo === "object" && logo && !Array.isArray(logo) ? logo.url : logo
    if (!isAbsoluteUrl(logoUrl)) problems.push(`${label(node)} has no absolute logo URL`)
  },
  WebSite(node, problems) {
    requireName(node, problems)
    requireUrl(node, problems)
  },
  Periodical(node, problems) {
    requireName(node, problems)
    requireUrl(node, problems)
  },
}

/**
 * Checks one parsed `application/ld+json` block, returning what's wrong with it. `@context` must sit on the
 * block itself: `@graph` nodes inherit it, so they carry none of their own.
 */
export function checkJsonLdBlock(block: JsonNode): string[] {
  const problems: string[] = []

  if (block["@context"] !== SCHEMA_CONTEXT) {
    problems.push(`block's @context is ${JSON.stringify(block["@context"])}, not ${SCHEMA_CONTEXT}`)
  }
  findEmptyValues(block, "$", problems)

  for (const node of topLevelNodes(block)) {
    if (block["@graph"] && "@context" in node) {
      problems.push(`${label(node)} repeats @context inside @graph`)
    }
    const rule = RULES[String(node["@type"])]
    if (rule) rule(node, problems)
    else problems.push(`${label(node)} has no rule in tests/e2e/structuredData.ts`)
  }
  return problems
}
