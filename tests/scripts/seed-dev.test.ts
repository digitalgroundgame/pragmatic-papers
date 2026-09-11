import { beforeEach, describe, expect, it, vi } from "vitest"

const mockDestroy = vi.fn()
const mockPayload = { db: { destroy: mockDestroy } }
const mockSeed = vi.fn()

vi.mock("dotenv/config", () => ({}))

vi.mock("payload", () => ({
  getPayload: vi.fn().mockResolvedValue(mockPayload),
}))

vi.mock("@payload-config", () => ({ default: {} }))

vi.mock("@/endpoints/seed", () => ({
  seed: mockSeed,
}))

const { main } = await import("../../scripts/seed-dev")

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv("NODE_ENV", "test")
})

describe("seed-dev main()", () => {
  it("calls seed() with the payload instance and a progress callback", async () => {
    await main()

    expect(mockSeed).toHaveBeenCalledWith(mockPayload, expect.any(Function))
  })

  it("throws and does not seed when NODE_ENV is production", async () => {
    vi.stubEnv("NODE_ENV", "production")

    await expect(main()).rejects.toThrow("Seeding is not allowed in production")
    expect(mockSeed).not.toHaveBeenCalled()
  })

  it("destroys the db connection after a successful run", async () => {
    await main()

    expect(mockDestroy).toHaveBeenCalledOnce()
  })

  it("always destroys the db connection, even if seed() throws", async () => {
    mockSeed.mockRejectedValueOnce(new Error("seed error"))

    await expect(main()).rejects.toThrow("seed error")

    expect(mockDestroy).toHaveBeenCalledOnce()
  })
})
