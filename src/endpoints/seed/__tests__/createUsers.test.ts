import { describe, expect, it, vi } from "vitest"

import { createUsers } from "../users"

const mockCreate = vi.fn()
const mockWarn = vi.fn()

const mockPayload = {
  create: mockCreate,
  logger: { warn: mockWarn },
} as never

const userData = {
  email: "test@example.com",
  password: "password123",
  name: "Test User",
  roles: ["writer" as const],
  slug: "test-user",
  affiliation: "Test Institute",
}

const mockUser = { id: 1, ...userData }

describe("createUsers", () => {
  it("checks if disableRevalidate is true for every createUser call", async () => {
    mockCreate.mockResolvedValueOnce(mockUser)
    await createUsers(mockPayload, [])

    expect(mockCreate).toHaveBeenCalled()
    for (const call of mockCreate.mock.calls) {
      const options = call[0]
      expect(options).toEqual(
        expect.objectContaining({ context: expect.objectContaining({ disableRevalidate: true }) }),
      )
    }
  })
})
