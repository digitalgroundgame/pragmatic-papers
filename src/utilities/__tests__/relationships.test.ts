import { describe, expect, it } from "vitest"

import { isResolved, relationshipId } from "@/utilities/relationships"

interface Doc {
  id: number
  name: string
}

const doc: Doc = { id: 7, name: "Ada" }

describe("isResolved", () => {
  it("returns true for a resolved document", () => {
    expect(isResolved(doc)).toBe(true)
  })

  it("returns false for an unresolved id", () => {
    expect(isResolved<Doc>(7)).toBe(false)
  })

  it("returns false for null and undefined", () => {
    expect(isResolved<Doc>(null)).toBe(false)
    expect(isResolved<Doc>(undefined)).toBe(false)
  })

  it("narrows to the document type", () => {
    const rel: Doc | number = doc
    expect(isResolved(rel) ? rel.name : "unresolved").toBe("Ada")
  })

  it("filters a mixed relationship array down to resolved documents", () => {
    const rels: (Doc | number)[] = [doc, 12, { id: 3, name: "Grace" }]
    expect(rels.filter(isResolved<Doc>).map((d) => d.name)).toEqual(["Ada", "Grace"])
  })
})

describe("relationshipId", () => {
  it("reads the id off a resolved document", () => {
    expect(relationshipId(doc)).toBe(7)
  })

  it("passes an unresolved id through", () => {
    expect(relationshipId<Doc>(7)).toBe(7)
  })

  it("returns null when the relationship is unset", () => {
    expect(relationshipId<Doc>(null)).toBeNull()
    expect(relationshipId<Doc>(undefined)).toBeNull()
  })

  it("keeps id 0 rather than treating it as unset", () => {
    expect(relationshipId<Doc>(0)).toBe(0)
  })
})
