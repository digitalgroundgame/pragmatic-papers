// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const { mockWarmPages, payload } = vi.hoisted(() => ({
  mockWarmPages: vi.fn(),
  payload: { find: vi.fn(), logger: { info: vi.fn(), warn: vi.fn() } },
}))

vi.mock("../warmPages", () => ({ warmPages: mockWarmPages, PURGE_SETTLE_MS: 0 }))
vi.mock("@/data/payload", () => ({ getPayloadClient: async () => payload }))

const { warmWorker, warmWorkerSoon, workerWarmed } = await import("../warmWorker")

const WORKER = "https://worker.example.com"
const logger = { info: vi.fn(), warn: vi.fn() }

beforeEach(() => {
  vi.stubEnv("WORKER_URL", WORKER)
  mockWarmPages.mockReset().mockResolvedValue(undefined)
  logger.warn.mockClear()
})

afterEach(async () => {
  await workerWarmed()
  vi.unstubAllEnvs()
})

describe("warmWorker", () => {
  it("warms the most-read pages through the Worker's URL", async () => {
    await warmWorker(payload as never)

    expect(mockWarmPages).toHaveBeenCalledExactlyOnceWith(payload, {
      fetchImpl: undefined,
      baseURL: WORKER,
      occasion: "on the Worker",
    })
  })

  it("does nothing without the Worker's URL", async () => {
    vi.stubEnv("WORKER_URL", "")

    await warmWorker(payload as never)

    expect(mockWarmPages).not.toHaveBeenCalled()
  })
})

describe("warmWorkerSoon", () => {
  it("warms in the background", async () => {
    warmWorkerSoon(logger)
    expect(mockWarmPages).not.toHaveBeenCalled()

    await workerWarmed()

    expect(mockWarmPages).toHaveBeenCalledOnce()
  })

  it("warms once more after a warm-up that saves interrupted, however many there were", async () => {
    let finish!: () => void
    mockWarmPages.mockImplementationOnce(() => new Promise<void>((resolve) => (finish = resolve)))

    warmWorkerSoon(logger)
    await vi.waitFor(() => expect(mockWarmPages).toHaveBeenCalledOnce())
    warmWorkerSoon(logger)
    warmWorkerSoon(logger)
    finish()
    await workerWarmed()

    expect(mockWarmPages).toHaveBeenCalledTimes(2)
  })

  it("logs a warm-up that couldn't start, and never throws", async () => {
    mockWarmPages.mockRejectedValueOnce(new Error("no database"))

    warmWorkerSoon(logger)
    await workerWarmed()

    expect(logger.warn).toHaveBeenCalledWith("Couldn't warm the Worker's pages: no database")
  })
})
