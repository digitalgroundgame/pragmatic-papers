import type { Payload } from "payload"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { resolveAuthorNames } from "../index"

const find = vi.fn()
const error = vi.fn()

const payload = { find, logger: { error } } as unknown as Payload

describe("resolveAuthorNames", () => {
  beforeEach(() => {
    find.mockReset()
    error.mockReset()
  })

  it("reads names straight off already populated authors", async () => {
    const names = await resolveAuthorNames([{ id: 1, name: "Jane Doe" }], payload)

    expect(find).not.toHaveBeenCalled()
    expect(names).toBe("Jane Doe")
  })

  it("resolves bare IDs in one batched query", async () => {
    // The reindex handler fetches at depth 0, so authors arrive as IDs.
    find.mockResolvedValue({
      docs: [
        { id: 2, name: "John Smith" },
        { id: 1, name: "Jane Doe" },
      ],
    })

    const names = await resolveAuthorNames([1, 2], payload)

    expect(find).toHaveBeenCalledTimes(1)
    expect(find.mock.calls[0]?.[0]).toMatchObject({
      collection: "users",
      where: { id: { in: [1, 2] } },
      select: { name: true },
    })
    expect(names).toBe("Jane Doe, John Smith")
  })

  it("preserves author order across a mix of IDs and populated docs", async () => {
    find.mockResolvedValue({ docs: [{ id: 2, name: "Second" }] })

    const names = await resolveAuthorNames(
      [{ id: 1, name: "First" }, 2, { id: 3, name: "Third" }],
      payload,
    )

    expect(find.mock.calls[0]?.[0]?.where).toEqual({ id: { in: [2] } })
    expect(names).toBe("First, Second, Third")
  })

  it("skips authors that do not resolve", async () => {
    find.mockResolvedValue({ docs: [{ id: 1, name: "Jane Doe" }] })

    expect(await resolveAuthorNames([1, 999], payload)).toBe("Jane Doe")
  })

  it("never requests fields beyond the name", async () => {
    find.mockResolvedValue({ docs: [] })

    await resolveAuthorNames([1], payload)

    expect(find.mock.calls[0]?.[0]?.select).toEqual({ name: true })
  })

  it("returns an empty string for missing or empty authors", async () => {
    expect(await resolveAuthorNames(undefined, payload)).toBe("")
    expect(await resolveAuthorNames(null, payload)).toBe("")
    expect(await resolveAuthorNames([], payload)).toBe("")
    expect(find).not.toHaveBeenCalled()
  })

  it("logs and falls back to populated names when the lookup fails", async () => {
    find.mockRejectedValue(new Error("db down"))

    const names = await resolveAuthorNames([{ id: 1, name: "Jane Doe" }, 2], payload)

    expect(error).toHaveBeenCalledOnce()
    expect(names).toBe("Jane Doe")
  })
})
