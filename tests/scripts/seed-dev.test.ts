import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

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

const { assertLocalTarget, failUnfinishedExit, main } = await import("../../scripts/seed-dev")

const LOCAL_URI = "postgres://postgres:postgres@localhost:9000/pragmatic-papers"

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv("NODE_ENV", "test")
  vi.stubEnv("DATABASE_URI", LOCAL_URI)
  vi.stubEnv("USE_LOCAL_STORAGE", "true")
  vi.stubEnv("SEED_ALLOW_REMOTE", undefined)
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe("assertLocalTarget()", () => {
  const env = (overrides: Record<string, string | undefined>) => ({
    DATABASE_URI: LOCAL_URI,
    USE_LOCAL_STORAGE: "true",
    ...overrides,
  })

  it.each(["localhost:9000", "127.0.0.1", "[::1]:5432"])("accepts a database at %s", (host) => {
    expect(() =>
      assertLocalTarget(env({ DATABASE_URI: `postgres://u:p@${host}/db` })),
    ).not.toThrow()
  })

  it.each(["db.staging.example.com", "postgres", "10.0.0.5"])(
    "refuses a database at %s",
    (host) => {
      expect(() =>
        assertLocalTarget(env({ DATABASE_URI: `postgres://u:p@${host}:5432/db` })),
      ).toThrow(`Refusing to seed the database at ${host}`)
    },
  )

  it("refuses a missing or unparseable DATABASE_URI", () => {
    expect(() => assertLocalTarget(env({ DATABASE_URI: undefined }))).toThrow(
      "without a valid DATABASE_URI",
    )
    expect(() => assertLocalTarget(env({ DATABASE_URI: "not a url" }))).toThrow(
      "without a valid DATABASE_URI",
    )
  })

  it("refuses remote media storage", () => {
    expect(() => assertLocalTarget(env({ USE_LOCAL_STORAGE: "false" }))).toThrow(
      "Refusing to seed without USE_LOCAL_STORAGE=true",
    )
  })

  it("lets SEED_ALLOW_REMOTE=true through a remote database and storage", () => {
    expect(() =>
      assertLocalTarget(
        env({
          DATABASE_URI: "postgres://u:p@db.staging.example.com/db",
          USE_LOCAL_STORAGE: "false",
          SEED_ALLOW_REMOTE: "true",
        }),
      ),
    ).not.toThrow()
  })

  it("never allows production, even with SEED_ALLOW_REMOTE", () => {
    expect(() =>
      assertLocalTarget(env({ NODE_ENV: "production", SEED_ALLOW_REMOTE: "true" })),
    ).toThrow("Seeding is not allowed in production")
  })
})

describe("failUnfinishedExit()", () => {
  afterEach(() => {
    process.exitCode = undefined
  })

  it("turns a clean exit before seeding finished into a failure", () => {
    const error = vi.spyOn(console, "error").mockImplementation(vi.fn())

    failUnfinishedExit(() => false)(0)

    expect(process.exitCode).toBe(1)
    expect(error).toHaveBeenCalledWith(expect.stringContaining("Exited before seeding"))
    error.mockRestore()
  })

  it("leaves a finished run or an existing failure alone", () => {
    failUnfinishedExit(() => true)(0)
    expect(process.exitCode).toBeUndefined()

    failUnfinishedExit(() => false)(1)
    expect(process.exitCode).toBeUndefined()
  })
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

  it("refuses a non-local database before connecting to it", async () => {
    const { getPayload } = await import("payload")
    vi.stubEnv("DATABASE_URI", "postgres://u:p@db.staging.example.com:5432/db")

    await expect(main()).rejects.toThrow("Refusing to seed the database at db.staging.example.com")
    expect(getPayload).not.toHaveBeenCalled()
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
