import deepMerge from "./deepMerge"

describe("deepMerge", () => {
  it("merges two flat objects", () => {
    expect(deepMerge({ a: 1 }, { b: 2 })).toEqual({ a: 1, b: 2 })
  })

  it("overwrites target properties with source values", () => {
    expect(deepMerge({ a: 1 }, { a: 2 })).toEqual({ a: 2 })
  })

  it("deep merges nested objects", () => {
    expect(deepMerge({ a: { x: 1 } }, { a: { y: 2 } })).toEqual({ a: { x: 1, y: 2 } })
  })

  it("handles multiple levels of nesting", () => {
    const target = { a: { b: { c: 1 } } }
    const source = { a: { b: { d: 2 } } }
    expect(deepMerge(target, source)).toEqual({ a: { b: { c: 1, d: 2 } } })
  })

  it("replaces arrays instead of merging them", () => {
    expect(deepMerge({ a: [1, 2] }, { a: [3] })).toEqual({ a: [3] })
  })

  it("returns target unchanged when source is empty", () => {
    expect(deepMerge({ a: 1 }, {})).toEqual({ a: 1 })
  })

  it("adds new nested object from source", () => {
    expect(deepMerge({}, { a: { b: 1 } })).toEqual({ a: { b: 1 } })
  })
})
