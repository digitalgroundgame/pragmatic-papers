import type { NextRequest } from "next/server"
import { beforeEach, describe, expect, it, vi } from "vitest"

const auth = vi.fn()
const draft = { enable: vi.fn(), disable: vi.fn() }
const redirect = vi.fn()

vi.mock("payload", () => ({
  getPayload: vi.fn(async () => ({ auth, logger: { error: vi.fn() } })),
}))
vi.mock("@payload-config", () => ({ default: Promise.resolve({}) }))
vi.mock("next/headers", () => ({ draftMode: vi.fn(async () => draft) }))
vi.mock("next/navigation", () => ({ redirect: (path: string) => redirect(path) }))

const { GET } = await import("../route")

const previewRequest = (): NextRequest => {
  const url = new URL("http://localhost/next/preview")
  url.searchParams.set("path", "/articles/draft-article")
  url.searchParams.set("collection", "articles")
  url.searchParams.set("slug", "draft-article")
  url.searchParams.set("previewSecret", "secret")
  return { nextUrl: url, headers: new Headers() } as unknown as NextRequest
}

describe("GET /next/preview", () => {
  beforeEach(() => {
    vi.stubEnv("PREVIEW_SECRET", "secret")
    auth.mockReset()
    draft.enable.mockClear()
    draft.disable.mockClear()
    redirect.mockClear()
  })

  it("refuses draft mode when the request has the secret but no logged-in user", async () => {
    auth.mockResolvedValue({ user: null, permissions: {}, responseHeaders: new Headers() })

    const response = await GET(previewRequest())

    expect(response.status).toBe(403)
    expect(draft.enable).not.toHaveBeenCalled()
    expect(draft.disable).toHaveBeenCalled()
    expect(redirect).not.toHaveBeenCalled()
  })

  it("enables draft mode and redirects for a logged-in user", async () => {
    auth.mockResolvedValue({ user: { id: 1 }, permissions: {}, responseHeaders: new Headers() })

    await GET(previewRequest())

    expect(draft.enable).toHaveBeenCalled()
    expect(redirect).toHaveBeenCalledWith("/articles/draft-article")
  })

  it("refuses a request with the wrong preview secret", async () => {
    const request = previewRequest()
    request.nextUrl.searchParams.set("previewSecret", "wrong")

    const response = await GET(request)

    expect(response.status).toBe(403)
    expect(auth).not.toHaveBeenCalled()
  })
})
