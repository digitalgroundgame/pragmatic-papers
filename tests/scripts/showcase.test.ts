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

const { createRestPayload, main, resolveTarget, selectEntries, slugsFromDescription } =
  await import("../../scripts/showcase")

const ORIGIN = "https://pr-748.pragmaticpapers.com"
const PUSHER = { id: 7, roles: ["writer"] }
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
    expect(resolveTarget("748")).toEqual({ origin: ORIGIN, draftByDefault: false })
  })

  it("keeps only the origin of a URL", () => {
    expect(resolveTarget("https://staging.example.com/admin").origin).toBe(
      "https://staging.example.com",
    )
  })

  it("reads staging's URL from SHOWCASE_STAGING_URL, and pushes drafts there", () => {
    expect(
      resolveTarget("staging", { SHOWCASE_STAGING_URL: "https://staging.example.com/" }),
    ).toEqual({ origin: "https://staging.example.com", draftByDefault: true })
  })

  it("needs SHOWCASE_STAGING_URL for staging", () => {
    expect(() => resolveTarget("staging", {})).toThrow("Set SHOWCASE_STAGING_URL")
  })

  it("rejects anything else", () => {
    expect(() => resolveTarget("pr-748")).toThrow("Not a PR number or URL: pr-748")
  })
})

describe("slugsFromDescription", () => {
  it.each([
    ["Showcase: first second", ["first", "second"]],
    ["Showcase: first, second-part", ["first", "second-part"]],
    ["**Showcase:** `first`", ["first"]],
    ["- showcase: first", ["first"]],
    ["## Context\n\nShowcase: first\n\nMore text", ["first"]],
    ["Showcase: all", ["all"]],
  ])("reads %j", (description, slugs) => {
    expect(slugsFromDescription(description)).toEqual(slugs)
  })

  it("finds nothing without a Showcase: line", () => {
    expect(slugsFromDescription("Adds a showcase for the table of contents")).toEqual([])
  })
})

describe("selectEntries", () => {
  it("returns every entry with --all", () => {
    expect(selectEntries([], true).map((entry) => entry.slug)).toEqual(["first", "second"])
  })

  it("narrows to the named slugs", () => {
    expect(selectEntries(["second"]).map((entry) => entry.slug)).toEqual(["second"])
  })

  it("lists the known slugs when none is named", () => {
    expect(() => selectEntries([])).toThrow(
      "Name the articles to push, or --all:\n  first\n  second",
    )
  })

  it("names unknown slugs and lists the known ones", () => {
    expect(() => selectEntries(["missing"])).toThrow("No showcase entry for missing. Known:")
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

  it("creates articles as drafts in draft mode, and leaves other collections alone", async () => {
    const fetchImpl = fakeFetch({
      "POST /api/articles": () => json({ doc: { id: 3 } }, 201),
      "POST /api/media": () => json({ doc: { id: 4 } }, 201),
    })
    const { create } = createRestPayload(ORIGIN, "tok", fetchImpl, {
      draft: true,
    }) as unknown as { create: RestCreate }
    await create({ collection: "articles", data: { title: "Hi", _status: "published" } })
    await create({ collection: "media", data: { alt: "Alt" } })

    const [articleUrl, articleInit] = fetchImpl.mock.calls[0]!
    expect(new URL(String(articleUrl)).searchParams.get("draft")).toBe("true")
    expect(JSON.parse((articleInit as RequestInit).body as string)).toEqual({
      title: "Hi",
      _status: "draft",
    })
    const [mediaUrl, mediaInit] = fetchImpl.mock.calls[1]!
    expect(new URL(String(mediaUrl)).searchParams.has("draft")).toBe(false)
    expect(JSON.parse((mediaInit as RequestInit).body as string)).toEqual({ alt: "Alt" })
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
    (user = PUSHER) =>
    () =>
      json({ token: "tok", user })

  it("requires credentials", async () => {
    await expect(main(["748", "first"], {}, fakeFetch({}))).rejects.toThrow(
      "Set SHOWCASE_EMAIL and SHOWCASE_PASSWORD",
    )
  })

  it("rejects unknown options", async () => {
    await expect(main(["748", "--everything"], ENV, fakeFetch({}))).rejects.toThrow(
      "Unknown option --everything",
    )
  })

  it("refuses an account that cannot be credited as author", async () => {
    const fetchImpl = fakeFetch({ "POST /api/users/login": login({ id: 1, roles: ["admin"] }) })
    await expect(main(["748", "first"], ENV, fetchImpl)).rejects.toThrow("(has: admin)")
    expect(mockCreateStockMedia).not.toHaveBeenCalled()
  })

  it("does nothing when the description has no Showcase: line", async () => {
    const fetchImpl = fakeFetch({})
    await main(
      ["748", "--from-description"],
      { ...ENV, SHOWCASE_DESCRIPTION: "No line" },
      fetchImpl,
    )
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it("pushes every entry for Showcase: all", async () => {
    const fetchImpl = fakeFetch({
      "POST /api/users/login": login(),
      "GET /api/articles": () => json({ totalDocs: 0 }),
    })

    await main(
      ["748", "--from-description"],
      { ...ENV, SHOWCASE_DESCRIPTION: "Showcase: all" },
      fetchImpl,
    )

    expect(mockCreate).toHaveBeenCalledTimes(2)
  })

  it("creates only the entries whose slug is missing", async () => {
    const fetchImpl = fakeFetch({
      "POST /api/users/login": login(),
      "GET /api/articles": (url) =>
        json({ totalDocs: url.searchParams.get("where[slug][equals]") === "first" ? 1 : 0 }),
    })

    const links = await main(["748", "--all"], ENV, fetchImpl)

    expect(mockCreateStockMedia).toHaveBeenCalledOnce()
    expect(mockCreate).toHaveBeenCalledOnce()
    expect(mockCreate).toHaveBeenCalledWith(expect.anything(), [PUSHER], [{ id: 1 }])
    expect(links).toEqual([
      `- [first](${ORIGIN}/articles/first)`,
      `- [second](${ORIGIN}/articles/second)`,
    ])
  })

  it("links to drafts in the admin", async () => {
    const fetchImpl = fakeFetch({
      "POST /api/users/login": login(),
      "GET /api/articles": () => json({ totalDocs: 0 }),
    })

    const links = await main(["748", "first", "--draft"], ENV, fetchImpl)

    expect(links).toEqual([`- [first](${ORIGIN}/admin/collections/articles/99)`])
  })

  it("uploads nothing when every entry is already there", async () => {
    const fetchImpl = fakeFetch({
      "POST /api/users/login": login(),
      "GET /api/articles": () => json({ totalDocs: 1 }),
    })

    await main(["748", "first", "second"], ENV, fetchImpl)

    expect(mockCreateStockMedia).not.toHaveBeenCalled()
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it("pushes the slugs from the description to staging as drafts", async () => {
    const fetchImpl = fakeFetch({
      "POST /api/users/login": login(),
      "GET /api/articles": () => json({ totalDocs: 0 }),
    })

    await main(
      ["staging", "--from-description"],
      {
        ...ENV,
        SHOWCASE_STAGING_URL: "https://staging.example.com",
        SHOWCASE_DESCRIPTION: "## Context\n\nShowcase: second",
      },
      fetchImpl,
    )

    expect(mockCreate).toHaveBeenCalledOnce()
    expect(console.warn).toHaveBeenCalledWith(
      "✔ Pushed as a draft: https://staging.example.com/admin/collections/articles/99",
    )
  })
})
