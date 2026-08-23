import { describe, expect, it } from "vitest"
import deepMerge, { isObject } from "../deepMerge"

describe("deepMerge", () => {
  it("merges nested objects while preserving untouched target keys", () => {
    const target = {
      title: "Original",
      meta: { description: "Old", image: "hero.jpg" },
    }
    const source = {
      meta: { description: "Updated" },
    }

    expect(deepMerge(target, source)).toEqual({
      title: "Original",
      meta: { description: "Updated", image: "hero.jpg" },
    })
  })

  it("adds nested objects that do not exist on the target", () => {
    expect(deepMerge({ title: "Post" }, { meta: { description: "Summary" } })).toEqual({
      title: "Post",
      meta: { description: "Summary" },
    })
  })

  it("replaces arrays and primitive values from the source", () => {
    const target = { tags: ["old"], published: false }
    const source = { tags: ["new", "featured"], published: true }

    expect(deepMerge(target, source)).toEqual(source)
  })

  it("does not mutate the target object", () => {
    const target = { nested: { value: 1 } }

    deepMerge(target, { nested: { value: 2 } })

    expect(target).toEqual({ nested: { value: 1 } })
  })
})

describe("isObject", () => {
  it("accepts object values and rejects arrays and primitives", () => {
    expect(isObject({})).toBe(true)
    expect(isObject([])).toBe(false)
    expect(isObject("value")).toBe(false)
    expect(isObject(42)).toBe(false)
  })
})
