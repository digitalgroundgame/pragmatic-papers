import { describe, expect, it, vi } from "vitest"

import { createUsers } from "../users"

const mockCreate = vi.fn()
const mockWarn = vi.fn()

const mockPayload = {
  create: mockCreate,
  logger: { warn: mockWarn },
} as never

describe("createUsers", () => {
  it("disables per-user revalidation on every create", async () => {
    mockCreate.mockImplementation(async ({ data }) => ({ id: 1, ...data }))

    const { writers } = await createUsers(mockPayload, [])

    expect(mockCreate).toHaveBeenCalledTimes(writers.length + 4)
    for (const [options] of mockCreate.mock.calls) {
      expect(options).toEqual(expect.objectContaining({ context: { disableRevalidate: true } }))
    }
  })
})
