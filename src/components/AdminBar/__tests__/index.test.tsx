import type React from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const { draft } = vi.hoisted(() => ({ draft: { isEnabled: false } }))

vi.mock("next/headers", () => ({ draftMode: async () => draft }))

import { AdminBar } from "../index"
import { AdminBarClient } from "../client"

beforeEach(() => {
  draft.isEnabled = false
})

describe("AdminBar", () => {
  it.each([true, false])(
    "hands draft mode (%s) to the client and nothing else",
    async (enabled) => {
      draft.isEnabled = enabled
      const bar = (await AdminBar()) as React.ReactElement<Record<string, unknown>>
      expect(bar.type).toBe(AdminBarClient)
      // Everything else the bar shows is looked up in the browser, so the page stays the same
      // for every reader and can be prerendered.
      expect(bar.props).toEqual({ preview: enabled })
    },
  )
})
