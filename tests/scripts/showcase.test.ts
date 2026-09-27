import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const mockCreateStockMedia = vi.fn()
const mockCreate = vi.fn()

vi.mock("dotenv/config", () => ({}))

vi.mock("@/endpoints/seed/media", () => ({
  createStockMedia: mockCreateStockMedia,
}))

vi.mock("@/endpoints/seed/showcase", () => ({
  showcaseEntries: [
    { slug: "first", create: mockCreate },
    { slug: "second", create: mockCreate },
  ],
}))

const { createRestPayload, main, resolveTarget, selectEntries } =
  await import("../../scripts/showcase")

const ORIGIN = "https://pr-748.pragmaticpapers.com"
const EDITOR = { id: 7, roles: ["editor"] }
const ENV = { SHOWCASE_EMAIL: "editor@example.com", SHOWCASE_PASSWORD: "secret" }

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status })
}

/** Routes each request by method and path; unmatched requests fail the test. */
function fakeFetch(routes: Record<string, (url: URL, init?: RequestInit) => Response>) {
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input))
    const key = `${init?.method ?? "GET"} ${url.pathname}`
    const route = routes[key]
    if (!route) throw new Error(`Unexpected request: ${key}`)
    return route(url, init)
  }) as unknown as typeof fetch & ReturnType<typeof vi.fn>
}

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => undefined)
  mockCreateStockMedia.mockResolvedValue([{ id: 1 }])
  mockCreate.mockResolvedValue(99)
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.clearAllMocks()
})

describe("resolveTarget", () => {
  it("maps a PR number to its preview", () => {
    expect(resolveTarget("748")).toBe(ORIGIN)
  })

  it("keeps only the origin of a URL", () => {
    expect(resolveTarget("https://staging.example.com/admin")).toBe("https://staging.example.com")
  })

  it("rejects anything else", () => {
    expect(() => resolveTarget("pr-748")).toThrow("Not a PR number or URL: pr-748")
  })
})

describe("selectEntries", () => {
  it("returns every entry when no slug is named", () => {
    expect(selectEntries([]).map((entry) => entry.slug)).toEqual(["first", "second"])
  })

  it("narrows to the named slugs", () => {
    expect(selectEntries(["second"]).map((entry) => entry.slug)).toEqual(["second"])
  })

  it("names unknown slugs and lists the known ones", () => {
    expect(() => selectEntries(["missing"])).toThrow(
      "No showcase entry for missing. Known: first, second",
    )
  })
})

type RestCreate = (args: { collection: string; data: object; file?: unknown }) => Promise<unknown>

/** The Local API's `create` is typed per collection; the REST stand-in takes any. */
function restCreate(fetchImpl: typeof fetch): RestCreate {
  return (createRestPayload(ORIGIN, "tok", fetchImpl) as unknown as { create: RestCreate }).create
}

describe("createRestPayload", () => {
  it("posts a document as JSON with the token", async () => {
    const fetchImpl = fakeFetch({ "POST /api/articles": () => json({ doc: { id: 3 } }, 201) })
    const doc = await restCreate(fetchImpl)({
      collection: "articles",
      data: { title: "Hi" },
    })

    expect(doc).toEqual({ id: 3 })
    const init = fetchImpl.mock.calls[0]![1] as RequestInit
    expect(init.headers).toMatchObject({
      Authorization: "JWT tok",
      "content-type": "application/json",
    })
    expect(JSON.parse(init.body as string)).toEqual({ title: "Hi" })
  })

  it("uploads a file as multipart with the data in _payload", async () => {
    const fetchImpl = fakeFetch({ "POST /api/media": () => json({ doc: { id: 4 } }, 201) })
    await restCreate(fetchImpl)({
      collection: "media",
      data: { alt: "Alt" },
      file: { name: "a.webp", data: Buffer.from("img"), mimetype: "image/webp", size: 3 },
    })

    const form = (fetchImpl.mock.calls[0]![1] as RequestInit).body as FormData
    expect(JSON.parse(form.get("_payload") as string)).toEqual({ alt: "Alt" })
    expect((form.get("file") as File).name).toBe("a.webp")
  })

  it("surfaces Payload's error messages", async () => {
    const fetchImpl = fakeFetch({
      "POST /api/articles": () => json({ errors: [{ message: "Authors is invalid" }] }, 400),
    })
    await expect(restCreate(fetchImpl)({ collection: "articles", data: {} })).rejects.toThrow(
      "Creating articles failed (400): Authors is invalid",
    )
  })
})

describe("main", () => {
  const login =
    (user = EDITOR) =>
    () =>
      json({ token: "tok", user })

  it("requires credentials", async () => {
    await expect(main(["748"], {}, fakeFetch({}))).rejects.toThrow(
      "Set SHOWCASE_EMAIL and SHOWCASE_PASSWORD",
    )
  })

  it("refuses an account that cannot be credited as author", async () => {
    const fetchImpl = fakeFetch({ "POST /api/users/login": login({ id: 1, roles: ["admin"] }) })
    await expect(main(["748"], ENV, fetchImpl)).rejects.toThrow("(has: admin)")
    expect(mockCreateStockMedia).not.toHaveBeenCalled()
  })

  it("creates only the entries whose slug is missing", async () => {
    const fetchImpl = fakeFetch({
      "POST /api/users/login": login(),
      "GET /api/articles": (url) =>
        json({ totalDocs: url.searchParams.get("where[slug][equals]") === "first" ? 1 : 0 }),
    })

    await main(["748"], ENV, fetchImpl)

    expect(mockCreateStockMedia).toHaveBeenCalledOnce()
    expect(mockCreate).toHaveBeenCalledOnce()
    expect(mockCreate).toHaveBeenCalledWith(expect.anything(), [EDITOR], [{ id: 1 }])
  })

  it("uploads nothing when every entry is already there", async () => {
    const fetchImpl = fakeFetch({
      "POST /api/users/login": login(),
      "GET /api/articles": () => json({ totalDocs: 1 }),
    })

    await main(["748"], ENV, fetchImpl)

    expect(mockCreateStockMedia).not.toHaveBeenCalled()
    expect(mockCreate).not.toHaveBeenCalled()
  })
})
