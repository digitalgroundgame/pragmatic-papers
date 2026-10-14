import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { syncShopifyProductsTask } from "../index"
import { syncBlockedReason } from "../logic"

vi.mock("next/cache", () => ({ revalidateTag: vi.fn() }))

const EMPTY = { created: 0, updated: 0, archived: 0, unchanged: 0 }

function setCredentials(): void {
  vi.stubEnv("SHOPIFY_STORE_DOMAIN", "store.example.org")
  vi.stubEnv("SHOPIFY_STOREFRONT_ACCESS_TOKEN", "shpat_test")
  vi.stubEnv("SHOPIFY_API_VERSION", "2026-07")
}

function makeReq() {
  const payload = {
    logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    find: vi.fn(async () => ({ docs: [], hasNextPage: false })),
    create: vi.fn(),
    update: vi.fn(),
  }
  return { payload }
}

async function run(req: ReturnType<typeof makeReq>) {
  const handler = syncShopifyProductsTask.handler
  if (typeof handler !== "function") throw new Error("expected an inline handler")
  // The handler only reads `req.payload`; the rest of the task arguments are unused.
  return handler({ req } as unknown as Parameters<typeof handler>[0])
}

describe("syncBlockedReason", () => {
  afterEach(() => vi.unstubAllEnvs())

  it("blocks when BUILD_ENV is unset or blank, whatever NODE_ENV says", () => {
    vi.stubEnv("NODE_ENV", "production")
    vi.stubEnv("BUILD_ENV", undefined)
    expect(syncBlockedReason()).toMatch(/BUILD_ENV/)
    vi.stubEnv("BUILD_ENV", "")
    expect(syncBlockedReason()).toMatch(/BUILD_ENV/)
  })

  it.each(["production", "staging", "preview"])("allows a %s deploy", (buildEnv) => {
    vi.stubEnv("BUILD_ENV", buildEnv)
    expect(syncBlockedReason()).toBeNull()
  })
})

describe("syncShopifyProductsTask handler", () => {
  const fetchSpy = vi.fn()

  beforeEach(() => {
    fetchSpy.mockReset()
    vi.stubGlobal("fetch", fetchSpy)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it("is a no-op off a deployed site, even with credentials set", async () => {
    setCredentials()
    vi.stubEnv("NODE_ENV", "production")
    vi.stubEnv("BUILD_ENV", undefined)
    const req = makeReq()

    await expect(run(req)).resolves.toEqual({ output: EMPTY })

    expect(fetchSpy).not.toHaveBeenCalled()
    expect(req.payload.find).not.toHaveBeenCalled()
    expect(req.payload.create).not.toHaveBeenCalled()
    expect(req.payload.update).not.toHaveBeenCalled()
    expect(req.payload.logger.warn).toHaveBeenCalledWith(expect.stringContaining("BUILD_ENV"))
  })

  it("is a no-op on a deployed site without credentials", async () => {
    vi.stubEnv("BUILD_ENV", "staging")
    vi.stubEnv("SHOPIFY_STORE_DOMAIN", "")
    vi.stubEnv("SHOPIFY_STOREFRONT_ACCESS_TOKEN", "")
    vi.stubEnv("SHOPIFY_API_VERSION", "")
    const req = makeReq()

    await expect(run(req)).resolves.toEqual({ output: EMPTY })

    expect(fetchSpy).not.toHaveBeenCalled()
    expect(req.payload.find).not.toHaveBeenCalled()
    expect(req.payload.create).not.toHaveBeenCalled()
    expect(req.payload.update).not.toHaveBeenCalled()
  })

  it("fetches the catalogue on a deployed site with credentials", async () => {
    setCredentials()
    vi.stubEnv("BUILD_ENV", "production")
    fetchSpy.mockResolvedValue({
      ok: true,
      status: 200,
      statusText: "OK",
      json: async () => ({
        data: { products: { nodes: [], pageInfo: { hasNextPage: false, endCursor: null } } },
      }),
    })
    const req = makeReq()

    await run(req)

    expect(fetchSpy).toHaveBeenCalledWith(
      "https://store.example.org/api/2026-07/graphql.json",
      expect.anything(),
    )
  })
})
