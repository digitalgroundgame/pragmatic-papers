import { describe, expectTypeOf, it } from "vitest"

import type { Prettify } from "@/utilities/prettify"

// Type-level only: `pnpm check-types` enforces these, the runtime assertions are no-ops.
describe("Prettify", () => {
  it("is equivalent to the intersection it flattens", () => {
    expectTypeOf<Prettify<{ a: number } & { b: string }>>().toEqualTypeOf<{
      a: number
      b: string
    }>()
  })

  it("keeps optional and readonly modifiers", () => {
    expectTypeOf<Prettify<{ readonly a?: number; b: string | null }>>().toEqualTypeOf<{
      readonly a?: number
      b: string | null
    }>()
  })

  it("does not widen or drop properties", () => {
    expectTypeOf<Prettify<{ a: 1 }>>().not.toEqualTypeOf<{ a: number }>()
    expectTypeOf<Prettify<{ a: 1; b: 2 }>>().not.toEqualTypeOf<{ a: 1 }>()
  })
})
