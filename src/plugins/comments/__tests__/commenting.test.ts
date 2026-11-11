import type { PayloadRequest, SelectField } from "payload"
import { describe, expect, it, vi } from "vitest"

import { commentingField, commentingOf } from "../commenting"
import type { ResolvedCommentsConfig } from "../types"

describe("commentingOf", () => {
  it("reads a document's choice, and takes one with none as open", () => {
    expect(commentingOf({ commenting: "locked" })).toBe("locked")
    expect(commentingOf({ commenting: "off" })).toBe("off")
    expect(commentingOf({ commenting: null })).toBe("open")
    expect(commentingOf({ commenting: "nonsense" })).toBe("open")
    expect(commentingOf({})).toBe("open")
    expect(commentingOf(null)).toBe("open")
  })
})

describe("commentingField", () => {
  const moderators = vi.fn()
  const field = commentingField({ moderators } as unknown as ResolvedCommentsConfig) as SelectField
  const update = field.access!.update!
  const ask = () => update({ req: {} as PayloadRequest } as Parameters<typeof update>[0])

  it("is open unless a moderator says otherwise, in the sidebar", () => {
    expect(field.defaultValue).toBe("open")
    expect(field.options).toEqual([
      { label: "Open", value: "open" },
      { label: "Locked", value: "locked" },
      { label: "Off", value: "off" },
    ])
    expect(field.admin?.position).toBe("sidebar")
  })

  it("lets only moderators change it", async () => {
    moderators.mockReturnValue(true)
    expect(await ask()).toBe(true)
    moderators.mockReturnValue(false)
    expect(await ask()).toBe(false)
    // A rule that answers with a query isn't a yes for a whole field.
    moderators.mockReturnValue({ id: { equals: 1 } })
    expect(await ask()).toBe(false)
  })
})
