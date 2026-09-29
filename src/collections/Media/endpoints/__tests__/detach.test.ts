import type { PayloadRequest } from "payload"
import { beforeEach, describe, expect, it, vi } from "vitest"

import type { User } from "@/payload-types"

import { collectMediaReferences } from "../../references/collectMediaReferences"
import { detachHandler } from "../detach"

// Keeps SOURCES real (detach checks fields against it); only the lookup is faked.
vi.mock("../../references/collectMediaReferences", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  collectMediaReferences: vi.fn(),
}))

const payload = { findByID: vi.fn(), update: vi.fn() }
const editor = { id: 1, roles: ["editor"] } as unknown as User

const request = (body: unknown, user: User | null = editor, id = "42") =>
  ({
    user,
    payload,
    routeParams: { id },
    context: {},
    json: () => Promise.resolve(body),
  }) as unknown as PayloadRequest

const hero = { collection: "articles", docId: 7, field: "heroImage" }

/** The published article, and its latest version (the same unless it has a draft). */
const article = (doc: Record<string, unknown>, latestStatus = "published") => {
  payload.findByID.mockImplementation(({ draft }: { draft?: boolean }) =>
    Promise.resolve(draft ? { ...doc, _status: latestStatus } : doc),
  )
}

const errorOf = async (response: Response) => ((await response.json()) as { error: string }).error

beforeEach(() => {
  payload.findByID.mockReset()
  payload.update.mockReset().mockResolvedValue({})
  vi.mocked(collectMediaReferences).mockReset().mockResolvedValue([])
})

describe("detachHandler", () => {
  it("clears the field, publishes, and returns what still uses the media", async () => {
    article({ id: 7, heroImage: 42, _status: "published" })
    const left = [{ collection: "pages", field: "hero.media", docId: 2, docTitle: "Home" }]
    vi.mocked(collectMediaReferences).mockResolvedValue(left)

    const response = await detachHandler(request(hero))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ references: left })
    expect(payload.update).toHaveBeenCalledWith({
      collection: "articles",
      id: 7,
      context: {},
      depth: 0,
      data: { heroImage: null, _status: "published" },
      draft: false,
      overrideAccess: false,
      user: editor,
    })
  })

  it("reads and writes as the requesting user", async () => {
    article({ id: 7, heroImage: 42 })

    await detachHandler(request(hero))

    for (const [args] of payload.findByID.mock.calls) {
      expect(args).toMatchObject({ overrideAccess: false, user: editor })
    }
  })

  it("doesn't add a status to a collection without drafts", async () => {
    payload.findByID.mockResolvedValue({ id: 3, profileImage: 42 })

    await detachHandler(request({ collection: "users", docId: 3, field: "profileImage" }))

    expect(payload.findByID).toHaveBeenCalledTimes(1)
    expect(payload.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { profileImage: null } }),
    )
  })

  it("refuses when the document has unpublished changes", async () => {
    article({ id: 7, heroImage: 42 }, "draft")

    const response = await detachHandler(request(hero))

    expect(response.status).toBe(409)
    expect(await errorOf(response)).toContain("unpublished changes")
    expect(payload.update).not.toHaveBeenCalled()
  })

  it("refuses when the field no longer uses the media", async () => {
    article({ id: 7, heroImage: 9 })

    const response = await detachHandler(request(hero))

    expect(response.status).toBe(409)
    expect(await errorOf(response)).toBe("The article hero image no longer uses this media.")
    expect(payload.update).not.toHaveBeenCalled()
  })

  it("says so when saving put the media back", async () => {
    article({ id: 7, heroImage: 42, meta: { image: 42 } })
    const still = [{ collection: "articles", field: "meta.image", docId: 7, docTitle: "Hero" }]
    vi.mocked(collectMediaReferences).mockResolvedValue(still)

    const response = await detachHandler(
      request({ collection: "articles", docId: 7, field: "meta.image" }),
    )

    expect(response.status).toBe(409)
    const body = (await response.json()) as { error: string; references: unknown }
    expect(body.error).toContain("Saving put the media back in the article SEO image")
    expect(body.references).toEqual(still)
  })

  it("passes on who may not edit or publish the document", async () => {
    article({ id: 7, heroImage: 42 })
    payload.update.mockRejectedValue(Object.assign(new Error("Forbidden"), { status: 403 }))

    const response = await detachHandler(request(hero))

    expect(response.status).toBe(403)
    expect(await errorOf(response)).toBe(
      "You don't have permission to edit and publish this article.",
    )
  })

  it("passes on a save that fails validation", async () => {
    payload.findByID.mockImplementation(({ draft }: { draft?: boolean }) =>
      Promise.resolve({
        id: 2,
        hero: { type: "highImpact", media: 42 },
        _status: draft ? "published" : undefined,
      }),
    )
    payload.update.mockRejectedValue(
      Object.assign(new Error("The following field is invalid: Hero > Media"), { status: 400 }),
    )

    const response = await detachHandler(
      request({ collection: "pages", docId: 2, field: "hero.media" }),
    )

    expect(response.status).toBe(400)
    expect(await errorOf(response)).toBe("The following field is invalid: Hero > Media")
  })

  it("reports a document that has gone", async () => {
    payload.findByID.mockRejectedValue(Object.assign(new Error("Not Found"), { status: 404 }))

    const response = await detachHandler(request(hero))

    expect(response.status).toBe(404)
  })

  it("rethrows anything unexpected", async () => {
    payload.findByID.mockRejectedValue(new Error("connection lost"))

    await expect(detachHandler(request(hero))).rejects.toThrow("connection lost")
  })

  it.each([
    ["no body", undefined],
    ["a missing field", { collection: "articles", docId: 7 }],
    ["a docId that isn't an id", { collection: "articles", docId: {}, field: "heroImage" }],
  ])("rejects %s", async (_, body) => {
    const response = await detachHandler(request(body))

    expect(response.status).toBe(400)
    expect(payload.findByID).not.toHaveBeenCalled()
  })

  it("refuses a field media isn't used from", async () => {
    const response = await detachHandler(
      request({ collection: "articles", docId: 7, field: "title" }),
    )

    expect(response.status).toBe(400)
    expect(await errorOf(response)).toBe("Media can't be detached from articles title.")
  })

  it("rejects anonymous, non-staff and bad-id requests", async () => {
    expect((await detachHandler(request(hero, null))).status).toBe(401)
    expect(
      (await detachHandler(request(hero, { id: 3, roles: ["member"] } as unknown as User))).status,
    ).toBe(403)
    expect((await detachHandler(request(hero, editor, "abc"))).status).toBe(400)
    expect(payload.findByID).not.toHaveBeenCalled()
  })
})
