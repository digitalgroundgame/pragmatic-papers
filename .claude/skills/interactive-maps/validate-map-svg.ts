/**
 * Reports what the Interactive Map block will actually see in an SVG, before a
 * writer uploads it to Map Assets.
 *
 * Choropleth mode (default):
 *   pnpm tsx .claude/skills/interactive-maps/validate-map-svg.ts <file.svg> [--data-attribute data-margin] [--scale divergingRedBlue|perRegion] [--bias 1]
 *
 * Drilldown mode — an overview asset, or a child asset paired with its overview so the
 * vertex-morph invariant can be checked:
 *   pnpm tsx .claude/skills/interactive-maps/validate-map-svg.ts <overview.svg> --mode drilldown
 *   pnpm tsx .claude/skills/interactive-maps/validate-map-svg.ts <child.svg> --mode drilldown --overview <overview.svg> --region <parentId>
 *
 * It imports the same sanitizer, parsers and validation the renderer uses, so its verdict is
 * the renderer's verdict — there is no second copy of the rules here to drift out of date.
 */
import { readFileSync } from "node:fs"

import { Parser } from "htmlparser2"

import { resolveInlineSvgMap } from "@/blocks/InteractiveMap/adapters/inlineSvg"
import {
  type ColorScaleType,
  DEFAULT_NEUTRAL,
  inferValueFormat,
} from "@/blocks/InteractiveMap/colorScale"
import { RESERVED_FACTS } from "@/blocks/InteractiveMap/drilldown/contract"
import { flipConstant } from "@/blocks/InteractiveMap/drilldown/geometry"
import { buildMorphPairs, parsePathAbs } from "@/blocks/InteractiveMap/drilldown/morph"
import { parseDrilldownAssetString } from "@/blocks/InteractiveMap/drilldown/parseAsset"
import { buildRegionIndex, displayFacts } from "@/blocks/InteractiveMap/drilldown/regions"
import type { DrilldownAsset } from "@/blocks/InteractiveMap/drilldown/types"
import { sanitizeMapSvg } from "@/blocks/InteractiveMap/sanitize"

const SURVIVING_TAGS = new Set(["svg", "g", "path", "title", "desc", "metadata"])

const out = (line = ""): void => void process.stdout.write(`${line}\n`)

interface Options {
  file: string
  mode: "choropleth" | "drilldown"
  dataAttribute: string | null
  scale: ColorScaleType
  bias: number
  overview: string | null
  region: string | null
}

const USAGE =
  "usage: pnpm tsx .claude/skills/interactive-maps/validate-map-svg.ts <file.svg> [--mode choropleth|drilldown] [--data-attribute data-margin] [--scale divergingRedBlue|perRegion] [--bias 1] [--overview overview.svg --region <parentId>]"

function parseArgs(argv: string[]): Options {
  const positional: string[] = []
  const opts: Options = {
    file: "",
    mode: "choropleth",
    dataAttribute: null,
    scale: "divergingRedBlue",
    bias: 1,
    overview: null,
    region: null,
  }
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!
    if (arg === "--data-attribute") opts.dataAttribute = argv[++i] ?? null
    else if (arg === "--scale") opts.scale = (argv[++i] as ColorScaleType) ?? "divergingRedBlue"
    else if (arg === "--bias") opts.bias = Number(argv[++i] ?? 1)
    else if (arg === "--mode") opts.mode = argv[++i] === "drilldown" ? "drilldown" : "choropleth"
    else if (arg === "--overview") opts.overview = argv[++i] ?? null
    else if (arg === "--region") opts.region = argv[++i] ?? null
    else positional.push(arg)
  }
  const file = positional[0]
  if (!file) {
    console.error(USAGE)
    process.exit(2)
  }
  opts.file = file
  return opts
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

function report(warnings: string[], errors: string[], okMessage: string): never {
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
  out(okMessage)
  process.exit(0)
}

// ---- choropleth -----------------------------------------------------------------------------

function validateChoropleth({ file, dataAttribute, scale, bias }: Options): never {
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
    errors.push(
      `No region carries a numeric ${dataAttribute} — every region falls back to neutral.`,
    )
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
  out(`mode             choropleth`)
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

  report(warnings, errors, "OK — this SVG renders as an Interactive Map.")
}

// ---- drilldown ------------------------------------------------------------------------------

function loadDrilldown(file: string): { raw: string; asset: DrilldownAsset } {
  const raw = readFileSync(file, "utf8")
  return { raw, asset: parseDrilldownAssetString(sanitizeMapSvg(raw)) }
}

function validateDrilldown({ file, overview: overviewFile, region }: Options): never {
  const { raw, asset } = loadDrilldown(file)
  const overview = overviewFile ? loadDrilldown(overviewFile).asset : null
  const dropped = findDroppedTags(raw)
  const errors: string[] = []
  const warnings: string[] = []
  const isChild = overview !== null

  const index = buildRegionIndex(overview ? [overview, asset] : [asset])
  const idsHere = new Set(asset.paths.map((p) => p.id).filter((id): id is string => id !== null))
  const declaredHere = new Set((asset.payload?.regions ?? []).map((r) => r.id))
  const knownIds = new Set([...Object.keys(index.byId)])

  // geometry --------------------------------------------------------------------------------
  if (asset.paths.length === 0 && !asset.payload?.records)
    errors.push("No <path> elements and no records — nothing to show.")
  if (asset.viewBox === null && asset.paths.length > 0)
    errors.push("No usable viewBox on the root <svg> — the map falls back to 0 0 100 100.")
  if (!asset.flipY && asset.paths.length > 0)
    warnings.push(
      "The first <g> carries no scale(1,-1) Y-flip. Fine for y-down exports; a geographic export will render upside down, and a child asset without the flip cannot morph.",
    )
  if (dropped.size > 0)
    warnings.push(
      `Sanitizer discards ${[...dropped].map(([t, n]) => `<${t}>×${n}`).join(", ")} — shape tags lose their geometry; container tags leak their children onto the map.`,
    )

  const counts = new Map<string, number>()
  for (const id of asset.paths.map((p) => p.id)) if (id) counts.set(id, (counts.get(id) ?? 0) + 1)
  const dupes = [...counts].filter(([, n]) => n > 1)
  if (dupes.length)
    warnings.push(
      `${dupes.length} id(s) appear on more than one path (${dupes
        .slice(0, 5)
        .map(([id, n]) => `${id}×${n}`)
        .join(
          ", ",
        )}${dupes.length > 5 ? ", …" : ""}). Multipolygons should be one path with several M…L… subpaths; separate paths morph independently and only the first one's facts count.`,
    )

  const decorative = asset.paths.filter((p) => !p.id).length
  const parents = asset.paths.filter((p) => p.id && !p.parentId)
  const children = asset.paths.filter((p) => p.id && p.parentId)
  const orphans = children.filter((p) => !knownIds.has(p.parentId!))
  if (orphans.length)
    errors.push(
      `${orphans.length} path(s) name a data-parent-id that matches no region: ${[...new Set(orphans.map((p) => p.parentId))].slice(0, 6).join(", ")}.`,
    )
  const unlabeled = [...idsHere].filter((id) => index.byId[id]?.label === id)
  if (unlabeled.length)
    warnings.push(
      `${unlabeled.length} region(s) have no data-region-label; the tooltip and selector will show the raw id (${unlabeled.slice(0, 6).join(", ")}${unlabeled.length > 6 ? ", …" : ""}).`,
    )

  // morph readiness ---------------------------------------------------------------------------
  const nonAbsolute = asset.paths.filter((p) => parsePathAbs(p.d) === null)
  if (nonAbsolute.length)
    warnings.push(
      `${nonAbsolute.length} path(s) use commands other than absolute M/L (${nonAbsolute
        .slice(0, 4)
        .map((p) => p.id ?? "(decorative)")
        .join(
          ", ",
        )}). Any view containing them falls back to zoom + crossfade instead of the vertex morph.`,
    )

  // metadata ------------------------------------------------------------------------------------
  const hasMetadata = /<metadata[\s>]/i.test(raw)
  if (asset.payloadError) errors.push(`<metadata> rejected: ${asset.payloadError}`)
  else if (hasMetadata && !asset.payload) errors.push("<metadata> is present but empty.")
  if (isChild && !asset.payload?.records)
    warnings.push(
      "Child asset carries no <metadata> records — the pane for its regions will be empty.",
    )

  const records = asset.payload?.records
  let recordRegionMisses = 0
  if (records) {
    const { display, items } = records
    for (const item of items) if (!knownIds.has(item._region)) recordRegionMisses++
    if (recordRegionMisses)
      warnings.push(
        `${recordRegionMisses}/${items.length} record(s) name a _region that matches no path id or declared region — they will never be shown.`,
      )
    const missingField = (field: string | undefined): boolean =>
      !!field && items.length > 0 && !items.some((r) => r[field] !== undefined)
    for (const [slot, field] of [
      ["display.title", display.title],
      ["display.shortTitle", display.shortTitle],
      ["display.category.field", display.category.field],
      ["display.order", display.order],
      ["display.status.field", display.status?.field],
      ["display.cohort", display.cohort],
      ["display.image.url", display.image?.url],
    ] as const) {
      if (missingField(field))
        warnings.push(`${slot} names "${field}" but no record has that field.`)
    }
    for (const line of display.details)
      if (missingField(line.field))
        warnings.push(
          `details line "${line.label ?? line.field}" reads "${line.field}" but no record has it.`,
        )
    if (display.seatsFact) {
      const regionsWithRecords = new Set(
        items.map((r) => r._region).filter((id) => knownIds.has(id)),
      )
      const noSeats = [...regionsWithRecords].filter(
        (id) => !(display.seatsFact! in (index.byId[id]?.facts ?? {})),
      )
      if (noSeats.length)
        warnings.push(
          `display.seatsFact "${display.seatsFact}" is missing on ${noSeats.length} region(s) with records (${noSeats.slice(0, 5).join(", ")}) — their seat count falls back to the number of active records.`,
        )
    }
  }

  const seats = asset.payload?.seats ?? overview?.payload?.seats
  if (seats) {
    const targets = isChild ? children.map((p) => p.id!) : parents.map((p) => p.id!)
    const withTotal = targets.filter((id) =>
      Number.isFinite(Number(index.byId[id]?.facts[seats.totalFact])),
    )
    if (targets.length && withTotal.length === 0)
      warnings.push(
        `seats.totalFact "${seats.totalFact}" is on none of the ${targets.length} region(s) here — no seat blocks will draw.`,
      )
    else if (withTotal.length < targets.length)
      warnings.push(
        `${targets.length - withTotal.length} region(s) have no ${seats.totalFact} — no seat block for them.`,
      )
    if (seats.anchorFact) {
      const bad = targets.filter((id) => {
        const v = index.byId[id]?.facts[seats.anchorFact!]
        return (
          v !== undefined &&
          v
            .split(/[\s,]+/)
            .map(Number)
            .some((n) => !Number.isFinite(n))
        )
      })
      if (bad.length)
        errors.push(
          `Unparseable ${seats.anchorFact} on ${bad.join(", ")} — expected "x,y" in this file's projected units.`,
        )
    }
  }

  // pairing with the overview ----------------------------------------------------------------
  let morphLine = "(no --overview given; pairing not checked)"
  if (overview) {
    if (!region)
      warnings.push(
        "No --region given: cannot tell which overview region this child asset belongs to.",
      )
    else if (
      !overview.paths.some((p) => p.id === region) &&
      !overview.payload?.regions?.some((r) => r.id === region)
    )
      errors.push(`--region "${region}" is not a path id or declared region in the overview.`)
    const key = (p: { id: string | null; parentId: string | null }, i: number): string =>
      p.id ? `shape:${p.id}` : `deco:${i}`
    const ovSrc = overview.paths.map((p, i) => ({ key: key(p, i), d: p.d, inset: p.inset }))
    const locSrc = asset.paths.map((p, i) => ({ key: key(p, i), d: p.d, inset: p.inset }))
    if (!overview.viewBox || !asset.viewBox) morphLine = "cannot pair: a viewBox is missing"
    else if (!overview.flipY || !asset.flipY)
      morphLine = "cannot pair: both files need the scale(1,-1) flip"
    else {
      const pairing = buildMorphPairs(
        ovSrc,
        locSrc,
        flipConstant(overview.viewBox),
        flipConstant(asset.viewBox),
      )
      if (!pairing) {
        morphLine = "FALLBACK — no interpolating shape; the view will zoom + crossfade"
        const twins = asset.paths.filter(
          (p) => p.id && overview.paths.some((o) => o.id === p.id && !o.inset && !p.inset),
        )
        for (const p of twins) {
          const o = overview.paths.find((x) => x.id === p.id)!
          const a = parsePathAbs(o.d)
          const b = parsePathAbs(p.d)
          if (a && b && (a.length !== b.length || a.some((s, i) => s.length !== b[i]!.length)))
            warnings.push(
              `"${p.id}" has ${a.reduce((n, s) => n + s.length / 2, 0)} vertices in the overview but ${b.reduce((n, s) => n + s.length / 2, 0)} here — simplify once, export twice.`,
            )
        }
      } else {
        morphLine = `${pairing.pairs.length} shape(s) morph · ${pairing.fadeOut.length} fade out · ${pairing.fadeIn.length} fade in`
      }
    }
    const foreign = children.filter(
      (p) =>
        region &&
        p.parentId !== region &&
        p.parentId &&
        overview.paths.some((o) => o.id === p.parentId),
    )
    if (foreign.length)
      warnings.push(
        `${foreign.length} child path(s) belong to a different parent than --region ${region}.`,
      )
  }

  // report ----------------------------------------------------------------------------------------
  out(`file             ${file}`)
  out(`mode             drilldown ${isChild ? `child asset of "${region ?? "?"}"` : "overview"}`)
  out(`bytes            ${raw.length} raw → ${sanitizeMapSvg(raw).length} sanitized`)
  out(
    `viewBox          ${asset.viewBox ? asset.viewBox.join(" ") : "(none)"} · Y-flip ${asset.flipY ? "yes (recomputed from viewBox)" : "no"}`,
  )
  out(
    `paths            ${asset.paths.length} total · ${parents.length} top-level · ${children.length} child · ${decorative} decorative`,
  )
  out(`declared         ${declaredHere.size} geometry-less region(s) in <metadata>`)
  out(
    `records          ${records ? `${records.items.length} (${records.items.filter((r) => r._role === "associate").length} associate)` : "(none)"}`,
  )
  out(
    `seat blocks      ${seats ? `total ${seats.totalFact} · ${seats.groups.map((g) => g.fact).join(" + ")}${seats.anchorFact ? ` · anchor ${seats.anchorFact}` : ""}` : "(none)"}`,
  )
  out(`morph            ${morphLine}`)
  out()
  out("region            label                 children  facts shown")
  const listed = isChild ? children.map((p) => p.id!) : index.topLevel
  for (const id of [...new Set(listed)].slice(0, 20)) {
    const r = index.byId[id]
    if (!r) continue
    const facts = displayFacts(r, asset.payload ?? overview?.payload)
    out(
      `${id.padEnd(17)} ${r.label.slice(0, 21).padEnd(21)} ${String(index.childrenOf[id]?.length ?? 0).padStart(8)}  ${facts
        .map((f) => `${f.label}=${f.value}`)
        .join(" · ")
        .slice(0, 80)}`,
    )
  }
  if (listed.length > 20) out(`… ${listed.length - 20} more`)
  for (const [key, name] of [
    [RESERVED_FACTS.summary, "summary"],
    [RESERVED_FACTS.childrenLabel, "children-label"],
  ] as const) {
    const n = listed.filter((id) => asset.paths.some((p) => p.id === id && key in p.facts)).length
    if (!isChild && n === 0)
      warnings.push(
        `No region carries data-${name}; the pane header/drill control will use defaults.`,
      )
  }

  report(warnings, errors, "OK — this SVG works as a drilldown asset.")
}

const opts = parseArgs(process.argv.slice(2))
if (opts.mode === "drilldown") validateDrilldown(opts)
else validateChoropleth(opts)
