import { Parser } from "htmlparser2"

export interface ParsedPath {
  d: string
  regionId: string | null
  extraAttrs: Record<string, string>
}

export interface ParsedSvg {
  viewBox: string | null
  transform: string | null
  paths: ParsedPath[]
}

const PATH_RESERVED_ATTRS = new Set(["d"])

function pickFirst<T>(...values: (T | null | undefined)[]): T | null {
  for (const v of values) if (v !== null && v !== undefined) return v
  return null
}

export function parseInlineSvg(svg: string, regionAttribute: string): ParsedSvg {
  const attrKey = regionAttribute.toLowerCase()
  let viewBox: string | null = null
  let transform: string | null = null
  const paths: ParsedPath[] = []
  let svgDepth = 0
  let firstGroupSeen = false

  const parser = new Parser(
    {
      onopentag(name, rawAttrs) {
        const tag = name.toLowerCase()
        // htmlparser2 lowercases attribute keys when configured to; normalize via a lookup helper.
        const attrs: Record<string, string> = {}
        for (const [k, v] of Object.entries(rawAttrs)) attrs[k.toLowerCase()] = v

        if (tag === "svg") {
          svgDepth += 1
          if (viewBox == null) viewBox = pickFirst(attrs.viewbox, attrs["viewBox"])
          return
        }
        if (svgDepth === 0) return

        if (tag === "g" && !firstGroupSeen) {
          firstGroupSeen = true
          transform = attrs.transform ?? null
          return
        }

        if (tag === "path") {
          const d = attrs.d
          if (!d) return
          const regionId = attrs[attrKey] ?? null
          const extraAttrs: Record<string, string> = {}
          for (const [k, v] of Object.entries(attrs)) {
            if (PATH_RESERVED_ATTRS.has(k)) continue
            if (k === attrKey) continue
            extraAttrs[k] = v
          }
          paths.push({ d, regionId, extraAttrs })
        }
      },
      onclosetag(name) {
        if (name.toLowerCase() === "svg") svgDepth = Math.max(0, svgDepth - 1)
      },
    },
    { xmlMode: false, lowerCaseTags: true, lowerCaseAttributeNames: false },
  )

  parser.write(svg)
  parser.end()

  return { viewBox, transform, paths }
}
