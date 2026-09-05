import { humanizeFactKey, isReservedFact, notesFromFacts, RESERVED_FACTS } from "./contract"
import type { DrilldownAsset, DrilldownPayload, FactMap, RegionIndex, RegionInfo } from "./types"

function emptyRegion(id: string): RegionInfo {
  return {
    id,
    label: id,
    parentId: null,
    inset: false,
    hasGeometry: false,
    layer: null,
    facts: {},
    summary: null,
    notes: [],
    childrenLabel: null,
    order: null,
  }
}

function applyFacts(region: RegionInfo, facts: FactMap): void {
  for (const [key, value] of Object.entries(facts)) {
    if (key === RESERVED_FACTS.summary) region.summary = value.trim() || region.summary
    else if (key === RESERVED_FACTS.childrenLabel)
      region.childrenLabel = value.trim() || region.childrenLabel
    else if (key === RESERVED_FACTS.order) {
      const n = Number(value)
      if (Number.isFinite(n)) region.order = n
    } else if (!isReservedFact(key)) region.facts[key] = value
  }
  const notes = notesFromFacts(facts)
  if (notes.length > 0) region.notes = notes
}

function sortIds(ids: string[], byId: Record<string, RegionInfo>): string[] {
  return [...ids].sort((a, b) => {
    const ra = byId[a]
    const rb = byId[b]
    if (!ra || !rb) return 0
    if (ra.order !== null && rb.order !== null && ra.order !== rb.order) return ra.order - rb.order
    if (ra.order !== null && rb.order === null) return -1
    if (ra.order === null && rb.order !== null) return 1
    return ra.label.localeCompare(rb.label, undefined, { numeric: true })
  })
}

/**
 * Builds the region hierarchy from one or more assets. Paths contribute geometry-bearing
 * regions (multiple paths may share an id: the first one's label wins, facts merge);
 * `<metadata>.regions` declares geometry-less ones. Later assets override earlier ones,
 * so a child asset's facts refine what the overview said about the same region.
 */
export function buildRegionIndex(assets: DrilldownAsset[]): RegionIndex {
  const byId: Record<string, RegionInfo> = {}
  const order: string[] = []

  const ensure = (id: string): RegionInfo => {
    let region = byId[id]
    if (!region) {
      region = emptyRegion(id)
      byId[id] = region
      order.push(id)
    }
    return region
  }

  for (const asset of assets) {
    for (const p of asset.paths) {
      if (!p.id) continue
      const region = ensure(p.id)
      region.hasGeometry = true
      if (p.label && (region.label === region.id || region.label !== p.label))
        region.label = p.label
      if (p.parentId) region.parentId = p.parentId
      if (p.layer) region.layer = p.layer
      if (p.inset) region.inset = true
      applyFacts(region, p.facts)
    }
    for (const declared of asset.payload?.regions ?? []) {
      const region = ensure(declared.id)
      if (declared.label) region.label = declared.label
      if (declared.parentId) region.parentId = declared.parentId
      if (declared.facts) applyFacts(region, declared.facts)
    }
  }

  const topLevel: string[] = []
  const childrenOf: Record<string, string[]> = {}
  for (const id of order) {
    const region = byId[id]!
    if (region.parentId && byId[region.parentId]) {
      ;(childrenOf[region.parentId] ??= []).push(id)
    } else if (!region.parentId) {
      topLevel.push(id)
    } else {
      // Parent named but never defined: keep it reachable as a top-level entry rather than
      // silently dropping a region the writer meant to show.
      topLevel.push(id)
    }
  }

  const sortedChildren: Record<string, string[]> = {}
  for (const [parent, ids] of Object.entries(childrenOf))
    sortedChildren[parent] = sortIds(ids, byId)

  return { byId, topLevel: sortIds(topLevel, byId), childrenOf: sortedChildren }
}

export interface DisplayFact {
  key: string
  label: string
  value: string
}

/**
 * The facts a reader sees for a region: hidden keys and the machine inputs the payload's
 * `seats`/`records` configuration consumes are removed, labels come from
 * `facts.labels` or the attribute name, and `facts.order` sorts what remains.
 */
export function displayFacts(
  region: RegionInfo,
  payload: DrilldownPayload | null | undefined,
): DisplayFact[] {
  const hidden = new Set<string>(payload?.facts?.hide ?? [])
  const seats = payload?.seats
  if (seats) {
    hidden.add(seats.totalFact)
    for (const g of seats.groups) hidden.add(g.fact)
    if (seats.anchorFact) hidden.add(seats.anchorFact)
    if (seats.labelFact) hidden.add(seats.labelFact)
  }
  if (payload?.records?.display.seatsFact) hidden.add(payload.records.display.seatsFact)

  const labels = payload?.facts?.labels ?? {}
  const explicitOrder = payload?.facts?.order ?? []
  const rank = new Map(explicitOrder.map((k, i) => [k, i]))

  return Object.entries(region.facts)
    .filter(([key, value]) => !hidden.has(key) && value.trim() !== "")
    .map(([key, value]) => ({ key, label: labels[key] ?? humanizeFactKey(key), value }))
    .sort((a, b) => {
      const ra = rank.get(a.key)
      const rb = rank.get(b.key)
      if (ra !== undefined && rb !== undefined) return ra - rb
      if (ra !== undefined) return -1
      if (rb !== undefined) return 1
      return 0
    })
}
