import type { BlocksField, Tab } from "payload"
import { describe, expect, it } from "vitest"

import { PANEL_SOURCES } from "@/blocks/Panel/config"

import { DEFAULT_ASIDES, Layouts } from "../config"

const tabs = (Layouts.fields[0] as { tabs: (Tab & { name: string })[] }).tabs
const asideOf = (name: string) =>
  tabs
    .find((tab) => tab.name === name)!
    .fields.find((field) => "name" in field && field.name === "aside") as BlocksField

describe("the Layouts global", () => {
  it("has a tab per template, each with an aside of shared Panel blocks", () => {
    expect(tabs.map((tab) => tab.name)).toEqual(["topic", "article"])
    for (const name of ["topic", "article"]) {
      expect(asideOf(name)).toMatchObject({
        type: "blocks",
        blocks: [],
        blockReferences: ["panel"],
      })
    }
  })

  it("starts each aside with the panels its template showed as code", () => {
    // A global no one has saved reads its defaults, so the site looks the same until then.
    expect(asideOf("topic").defaultValue).toEqual(DEFAULT_ASIDES.topic)
    expect(asideOf("article").defaultValue).toEqual(DEFAULT_ASIDES.article)
    const sources = new Set<string>(PANEL_SOURCES.map(({ value }) => value))
    for (const panel of [...DEFAULT_ASIDES.topic, ...DEFAULT_ASIDES.article]) {
      expect(sources).toContain(panel.source)
    }
  })

  it("lets readers read it and editors change it", () => {
    const req = (roles: string[] | null) =>
      ({ req: { user: roles && { id: 1, roles } } }) as unknown as Parameters<
        NonNullable<NonNullable<typeof Layouts.access>["update"]>
      >[0]
    expect(Layouts.access!.read!(req(null))).toBe(true)
    expect(Layouts.access!.update!(req(["editor"]))).toBe(true)
    expect(Layouts.access!.update!(req(["writer"]))).toBe(false)
  })
})
