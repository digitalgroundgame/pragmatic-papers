// @vitest-environment node
import type { Condition, Field } from "payload"
import { describe, expect, it } from "vitest"

import { canDeleteArticle, isDraftOrEditor } from "@/access/policies"
import { keepWritersFromUnpublishing } from "@/collections/Articles/hooks/keepWritersFromUnpublishing"
import { Articles } from "../index"

/** Finds a field by name anywhere in the config, through tabs, rows and groups. */
function findField(fields: Field[], name: string): Field | undefined {
  for (const field of fields) {
    if ("name" in field && field.name === name) return field
    if ("fields" in field) {
      const found = findField(field.fields, name)
      if (found) return found
    }
    if ("tabs" in field) {
      for (const tab of field.tabs) {
        const found = findField(tab.fields, name)
        if (found) return found
      }
    }
  }
  return undefined
}

function conditionOf(name: string): Condition {
  const field = findField(Articles.fields, name)
  const condition = field?.admin && "condition" in field.admin ? field.admin.condition : undefined
  if (!condition) throw new Error(`${name} has no admin condition`)
  return condition
}

const as = (role: string) => ({ user: { id: 1, roles: [role] } }) as never

describe("Articles access", () => {
  it("only editors take a live article down", () => {
    expect(Articles.access?.delete).toBe(canDeleteArticle)
    expect(Articles.access?.update).toBe(isDraftOrEditor)
    expect(Articles.hooks?.beforeOperation).toContain(keepWritersFromUnpublishing)
  })

  it("shows Syndicate to Substack to editors only", () => {
    const condition = conditionOf("syndicateToSubstack")
    expect(condition({}, {}, as("editor"))).toBe(true)
    expect(condition({}, {}, as("writer"))).toBe(false)
  })

  it("shows the Substack import URL to editors once the article is syndicated", () => {
    const condition = conditionOf("substackImportUrl")
    expect(condition({ syndicateToSubstack: true }, {}, as("editor"))).toBe(true)
    expect(condition({ syndicateToSubstack: false }, {}, as("editor"))).toBe(false)
    expect(condition({ syndicateToSubstack: true }, {}, as("writer"))).toBe(false)
  })
})
