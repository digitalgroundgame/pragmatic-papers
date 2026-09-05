import { describe, expect, it } from "vitest"

import { parseDrilldownAssetString } from "@/blocks/InteractiveMap/drilldown/parseAsset"
import { buildRegionIndex, displayFacts } from "@/blocks/InteractiveMap/drilldown/regions"
import { DRILLDOWN_SCHEMA } from "@/blocks/InteractiveMap/drilldown/types"

const overview = parseDrilldownAssetString(`<svg viewBox="0 0 10 10">
  <metadata>{"schema":"${DRILLDOWN_SCHEMA}","regions":[{"id":"fed","label":"Federal","facts":{"seats":"12","anchor":"1,2"}},{"id":"cit","label":"Trade","parentId":"fed"}],"facts":{"labels":{"seats":"Authorized"},"order":["vacant","seats"]},"seats":{"totalFact":"seats","groups":[{"fact":"seats-r","label":"R","color":"red"}],"anchorFact":"anchor"}}</metadata>
  <g>
    <path id="ca2" data-region-label="2nd Cir." data-order="2" data-seats="13" data-seats-r="5" data-vacant="1" data-summary="13 authorized" data-children-label="districts" data-note="Note A" data-note-seats="Note S" d="M0 0"/>
    <path id="ca1" data-region-label="1st Cir." data-order="1" data-seats="6" d="M0 0"/>
    <path id="nysd" data-region-label="S.D.N.Y." data-parent-id="ca2" d="M0 0"/>
    <path id="ctd" data-region-label="D. Conn." data-parent-id="ca2" data-inset="true" d="M0 0"/>
    <path id="ca2" d="M9 9"/>
    <path id="orphan" data-region-label="Orphan" data-parent-id="missing" d="M0 0"/>
    <path d="M5 5"/>
  </g></svg>`)

describe("buildRegionIndex", () => {
  const index = buildRegionIndex([overview])

  it("orders top-level regions by data-order, then label, and includes declared regions", () => {
    expect(index.topLevel).toEqual(["ca1", "ca2", "fed", "orphan"])
  })

  it("groups children under their parent in label order and flags insets", () => {
    expect(index.childrenOf.ca2).toEqual(["ctd", "nysd"])
    expect(index.byId.ctd?.inset).toBe(true)
    expect(index.childrenOf.fed).toEqual(["cit"])
    expect(index.byId.cit).toMatchObject({ label: "Trade", hasGeometry: false, parentId: "fed" })
  })

  it("separates reserved slots from display facts", () => {
    const ca2 = index.byId.ca2!
    expect(ca2.label).toBe("2nd Cir.")
    expect(ca2.summary).toBe("13 authorized")
    expect(ca2.childrenLabel).toBe("districts")
    expect(ca2.order).toBe(2)
    expect(ca2.notes).toEqual([
      { text: "Note A", mode: "always" },
      { text: "Note S", mode: "seats" },
    ])
    expect(ca2.facts).toEqual({ seats: "13", "seats-r": "5", vacant: "1" })
    expect(ca2.hasGeometry).toBe(true)
  })

  it("falls back to the id as label and keeps an orphan reachable at the top level", () => {
    expect(index.byId.fed?.label).toBe("Federal")
    expect(index.byId.orphan?.parentId).toBe("missing")
    expect(index.topLevel).toContain("orphan")
  })

  it("lets a later asset refine facts and geometry for the same region", () => {
    const child = parseDrilldownAssetString(
      `<svg viewBox="0 0 1 1"><g><path id="cit" data-region-label="Court of International Trade" data-seats="9" d="M0 0"/></g></svg>`,
    )
    const merged = buildRegionIndex([overview, child])
    expect(merged.byId.cit).toMatchObject({
      label: "Court of International Trade",
      hasGeometry: true,
      facts: { seats: "9" },
    })
  })
})

describe("displayFacts", () => {
  const index = buildRegionIndex([overview])

  it("hides seat-block inputs, applies labels and the configured order", () => {
    expect(displayFacts(index.byId.ca2!, overview.payload)).toEqual([
      { key: "vacant", label: "Vacant", value: "1" },
    ])
    expect(displayFacts(index.byId.fed!, overview.payload)).toEqual([])
  })

  it("shows everything with humanised labels when there is no payload", () => {
    expect(displayFacts(index.byId.ca2!, null)).toEqual([
      { key: "seats", label: "Seats", value: "13" },
      { key: "seats-r", label: "Seats r", value: "5" },
      { key: "vacant", label: "Vacant", value: "1" },
    ])
  })
})
