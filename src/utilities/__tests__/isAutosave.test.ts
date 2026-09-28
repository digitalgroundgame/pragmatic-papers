import type { PayloadRequest } from "payload"
import { describe, expect, it } from "vitest"

import { isAutosave } from "@/utilities/isAutosave"

const withAutosave = (autosave: unknown): PayloadRequest =>
  ({ query: { autosave } }) as unknown as PayloadRequest

describe("isAutosave", () => {
  it.each([true, "true", 1, "1"])("is true for autosave=%j", (autosave) => {
    expect(isAutosave(withAutosave(autosave))).toBe(true)
  })

  it.each([false, "false", 0, "0", "", "yes", null, undefined])(
    "is false for autosave=%j",
    (autosave) => {
      expect(isAutosave(withAutosave(autosave))).toBe(false)
    },
  )

  it("is false when the request has no query", () => {
    expect(isAutosave({} as PayloadRequest)).toBe(false)
  })

  it("is false when there is no request", () => {
    expect(isAutosave(undefined as unknown as PayloadRequest)).toBe(false)
  })
})
