import { beforeEach, describe, expect, it, vi } from "vitest"

import { createUser } from "../users"

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
  role: "writer" as const,
  slug: "test-user",
  affiliation: "Test Institute",
}

const mockUser = { id: 1, ...userData }

beforeEach(() => {
  vi.clearAllMocks()
})

describe("createUser", () => {
  it("creates a user with the full data and returns it", async () => {
    mockCreate.mockResolvedValueOnce(mockUser)

    const result = await createUser(mockPayload, userData, "test user")

    expect(mockCreate).toHaveBeenCalledOnce()
    expect(mockCreate).toHaveBeenCalledWith({
      collection: "users",
      data: userData,
      context: undefined,
    })
    expect(result).toBe(mockUser)
  })

  it("passes context through to payload.create", async () => {
    mockCreate.mockResolvedValueOnce(mockUser)
    const ctx = { disableRevalidate: true }

    await createUser(mockPayload, userData, "test user", ctx)

    expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({ context: ctx }))
  })

  it("retries with minimal fields when the first create fails", async () => {
    const minimalUser = { id: 2, email: userData.email, name: userData.name }
    mockCreate
      .mockRejectedValueOnce(new Error("validation error"))
      .mockResolvedValueOnce(minimalUser)

    const result = await createUser(mockPayload, userData, "test user")

    expect(mockCreate).toHaveBeenCalledTimes(2)
    expect(mockCreate).toHaveBeenLastCalledWith({
      collection: "users",
      data: {
        email: userData.email,
        password: userData.password,
        name: userData.name,
        role: userData.role,
        slug: userData.slug,
      },
      context: undefined,
    })
    expect(result).toBe(minimalUser)
  })

  it("logs a warning with the error message before retrying", async () => {
    mockCreate.mockRejectedValueOnce(new Error("unique constraint")).mockResolvedValueOnce(mockUser)

    await createUser(mockPayload, userData, "writer1")

    expect(mockWarn).toHaveBeenCalledOnce()
    expect(mockWarn).toHaveBeenCalledWith(expect.stringContaining("writer1"))
    expect(mockWarn).toHaveBeenCalledWith(expect.stringContaining("unique constraint"))
  })

  it("handles non-Error thrown values in the warning message", async () => {
    mockCreate.mockRejectedValueOnce("string error").mockResolvedValueOnce(mockUser)

    await createUser(mockPayload, userData, "test user")

    expect(mockWarn).toHaveBeenCalledWith(expect.stringContaining("string error"))
  })
})
