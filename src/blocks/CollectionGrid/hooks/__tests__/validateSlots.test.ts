import type { ArrayField, ValidateOptions } from "payload"
import { describe, expect, it } from "vitest"

import type { CollectionGridBlock } from "@/payload-types"
import { validateSlots } from "../validateSlots"

function options(
  layout: string | undefined,
): ValidateOptions<unknown, CollectionGridBlock, ArrayField, unknown[]> {
  return { siblingData: { layout } } as ValidateOptions<
    unknown,
    CollectionGridBlock,
    ArrayField,
    unknown[]
  >
}

describe("validateSlots", () => {
  it("passes when no layout has been selected yet", () => {
    expect(validateSlots([], options(undefined))).toBe(true)
  })

  it("passes when the layout key isn't in the registry", () => {
    expect(validateSlots([], options("retired-layout"))).toBe(true)
  })

  it("rejects a slot count below the layout's minimum", () => {
    const result = validateSlots([{}, {}], options("gauss-10"))
    expect(result).toBe("This layout requires at least 8 slots (currently 2).")
  })

  it("rejects a slot count above the layout's maximum", () => {
    const result = validateSlots(Array.from({ length: 11 }), options("gauss-10"))
    expect(result).toBe("This layout supports at most 10 slots (currently 11).")
  })

  it("passes when the slot count is within the layout's range", () => {
    expect(validateSlots(Array.from({ length: 9 }), options("gauss-10"))).toBe(true)
  })

  it("treats a missing value as zero slots", () => {
    const result = validateSlots(undefined, options("gauss-10"))
    expect(result).toBe("This layout requires at least 8 slots (currently 0).")
  })
})
