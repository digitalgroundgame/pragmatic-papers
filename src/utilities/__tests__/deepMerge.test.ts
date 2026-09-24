import { describe, expect, it } from "vitest"

import deepMerge, { isObject } from "@/utilities/deepMerge"

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

  it("returns an equal copy when the source is empty", () => {
    const target = { name: "link", admin: { hidden: false } }

    const result = deepMerge(target, {})

    expect(result).toEqual(target)
    expect(result).not.toBe(target)
  })

  it("returns the source's contents when the target is empty", () => {
    expect(deepMerge({}, { admin: { hidden: true } })).toEqual({ admin: { hidden: true } })
  })

  it("replaces a function on the target instead of merging into it", () => {
    const required = (value: unknown): true | string => Boolean(value) || "Required"

    expect(deepMerge({ validate: () => true }, { validate: required }).validate).toBe(required)
  })

  it("lets a null source value override an object on the target", () => {
    expect(deepMerge({ admin: { hidden: true } }, { admin: null })).toEqual({ admin: null })
  })

  it("lets a null source value override a primitive on the target", () => {
    expect(deepMerge({ label: "Link" }, { label: null })).toEqual({ label: null })
  })

  it("replaces a primitive target value with a source object", () => {
    expect(deepMerge({ meta: "none" }, { meta: { description: "Summary" } })).toEqual({
      meta: { description: "Summary" },
    })
  })

  it("replaces a null target value with a source object", () => {
    expect(deepMerge({ meta: null }, { meta: { description: "Summary" } })).toEqual({
      meta: { description: "Summary" },
    })
  })
})

describe("isObject", () => {
  it("accepts object values and rejects arrays and primitives", () => {
    expect(isObject({})).toBe(true)
    expect(isObject([])).toBe(false)
    expect(isObject("value")).toBe(false)
    expect(isObject(42)).toBe(false)
  })

  it("rejects null and undefined", () => {
    expect(isObject(null)).toBe(false)
    expect(isObject(undefined)).toBe(false)
  })
})
