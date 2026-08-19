/**
 * Reports what the Interactive Map block will actually see in an SVG, before a
 * writer uploads it to Map Assets.
 *
 * Run from the repo root:
 *   pnpm tsx .claude/skills/interactive-maps/validate-map-svg.ts <file.svg> [--data-attribute data-margin] [--scale divergingRedBlue|perRegion] [--bias 1]
 *
 * It imports the same sanitizer, parser, and color scale the renderer uses, so
 * its verdict is the renderer's verdict — there is no second copy of the rules
 * here to drift out of date.
 */
import { readFileSync } from "node:fs"

import { Parser } from "htmlparser2"

import { resolveInlineSvgMap } from "@/blocks/InteractiveMap/adapters/inlineSvg"
import {
  type ColorScaleType,
  DEFAULT_NEUTRAL,
  inferValueFormat,
} from "@/blocks/InteractiveMap/colorScale"
import { sanitizeMapSvg } from "@/blocks/InteractiveMap/sanitize"

const SURVIVING_TAGS = new Set(["svg", "g", "path", "title", "desc"])

const out = (line = ""): void => void process.stdout.write(`${line}\n`)

interface Options {
  file: string
  dataAttribute: string | null
  scale: ColorScaleType
  bias: number
}

function parseArgs(argv: string[]): Options {
  const positional: string[] = []
  let dataAttribute: string | null = null
  let scale: ColorScaleType = "divergingRedBlue"
  let bias = 1

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!
    if (arg === "--data-attribute") dataAttribute = argv[++i] ?? null
    else if (arg === "--scale") scale = (argv[++i] as ColorScaleType) ?? "divergingRedBlue"
    else if (arg === "--bias") bias = Number(argv[++i] ?? 1)
    else positional.push(arg)
  }

  const file = positional[0]
  if (!file) {
    console.error(
      "usage: pnpm tsx .claude/skills/interactive-maps/validate-map-svg.ts <file.svg> [--data-attribute data-margin] [--scale divergingRedBlue|perRegion] [--bias 1]",
    )
    process.exit(2)
  }
  return { file, dataAttribute, scale, bias }
}

/** Tag names in the raw file that the sanitizer discards, with occurrence counts. */
function findDroppedTags(svg: string): Map<string, number> {
  const dropped = new Map<string, number>()
  const parser = new Parser(
    {
      onopentag(name) {
        const tag = name.toLowerCase()
        if (SURVIVING_TAGS.has(tag)) return
        dropped.set(tag, (dropped.get(tag) ?? 0) + 1)
      },
    },
    { lowerCaseTags: true, lowerCaseAttributeNames: false },
  )
  parser.write(svg)
  parser.end()
  return dropped
}

const { file, dataAttribute, scale, bias } = parseArgs(process.argv.slice(2))
const raw = readFileSync(file, "utf8")
const dropped = findDroppedTags(raw)

const resolved = resolveInlineSvgMap({
  svg: raw,
  dataAttribute,
  scaleType: scale,
  colorBias: bias,
})

const regions = new Map(
  resolved.paths.filter((p) => p.region).map((p) => [p.region!.regionId, p.region!]),
)
const anonymousPaths = resolved.paths.filter((p) => !p.region).length
const withValue = [...regions.values()].filter((r) => r.formattedValue !== null).length
const neutral = [...regions.values()].filter((r) => r.color === DEFAULT_NEUTRAL).length

const errors: string[] = []
const warnings: string[] = []

if (resolved.paths.length === 0) errors.push("No <path> elements survived — nothing will render.")
if (regions.size === 0)
  errors.push("No path carries an id attribute — every region is inert (no color, no tooltip).")
if (dropped.size > 0)
  warnings.push(
    `Sanitizer discards ${[...dropped].map(([t, n]) => `<${t}>×${n}`).join(", ")} — shape tags lose their geometry; container tags (defs, clipPath, mask) leak their children onto the map.`,
  )
if (dataAttribute && regions.size > 0 && withValue === 0)
  errors.push(`No region carries a numeric ${dataAttribute} — every region falls back to neutral.`)
else if (dataAttribute && withValue < regions.size)
  warnings.push(`${regions.size - withValue} region(s) have no ${dataAttribute} value.`)
if (!dataAttribute && scale === "divergingRedBlue")
  warnings.push(
    "No --data-attribute given: with the diverging scale every region renders neutral unless you fill in Overrides.",
  )
if (scale === "divergingRedBlue" && dataAttribute && neutral > 0)
  warnings.push(
    `${neutral} region(s) land on the neutral fill (|value| below the 1.0 breakpoint, or no value).`,
  )

out(`file             ${file}`)
out(`bytes            ${raw.length} raw → ${sanitizeMapSvg(raw).length} sanitized`)
out(`viewBox          ${resolved.viewBox}`)
out(`group transform  ${resolved.transform ?? "(none)"}`)
out(
  `paths            ${resolved.paths.length} total · ${regions.size} region(s) · ${anonymousPaths} decorative (no id)`,
)
out(
  `data attribute   ${dataAttribute ?? "(none)"} → format "${inferValueFormat(dataAttribute)}" · ${withValue}/${regions.size} region(s) valued`,
)
out(`color scale      ${scale} (bias ${bias})`)
out()
out("region            value      color")
for (const region of [...regions.values()].slice(0, 20)) {
  const id = region.regionId.padEnd(17)
  const value = (region.formattedValue ?? "—").padEnd(10)
  out(`${id} ${value} ${region.color === DEFAULT_NEUTRAL ? "neutral" : region.color}`)
}
if (regions.size > 20) out(`… ${regions.size - 20} more`)

if (warnings.length > 0) {
  out()
  for (const w of warnings) out(`WARN  ${w}`)
}
if (errors.length > 0) {
  out()
  for (const e of errors) out(`ERROR ${e}`)
  process.exit(1)
}
out()
out("OK — this SVG renders as an Interactive Map.")
