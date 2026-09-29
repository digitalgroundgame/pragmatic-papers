import { renderHook } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { usePageMemory } from "../hooks/usePageMemory"

describe("usePageMemory", () => {
  it("defaults to the first page and remembers what it is told", () => {
    const { result } = renderHook(() => usePageMemory())
    expect(result.current.get(7)).toBe(0)

    result.current.set(7, 3)
    expect(result.current.get(7)).toBe(3)
  })

  it("starts from the seed and keeps it across renders", () => {
    const { result, rerender } = renderHook(({ seed }) => usePageMemory(seed), {
      initialProps: { seed: [[1, 2]] as Array<[number, number]> },
    })
    rerender({ seed: [[1, 9]] })
    expect(result.current.get(1)).toBe(2)
  })
})
