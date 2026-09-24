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
  it("seeds with revalidation disabled, since there is no Next.js request to revalidate", async () => {
    await main()

    expect(mockSeed).toHaveBeenCalledWith(mockPayload, expect.any(Function), {
      disableRevalidate: true,
    })
  })

  it("prints each step's progress and a completion line", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(vi.fn())
    mockSeed.mockImplementationOnce(async (_payload, onProgress) => {
      onProgress("Creating users...", 3, 11)
    })

    await main()

    expect(warn).toHaveBeenCalledWith("[3/11] Creating users...")
    expect(warn).toHaveBeenLastCalledWith("✔ Dev seed complete")
    warn.mockRestore()
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
