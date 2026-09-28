import type { PayloadRequest } from "payload"
import { beforeEach, describe, expect, it, vi } from "vitest"

import type { User } from "@/payload-types"

import { collectMediaReferences } from "../../references/collectMediaReferences"
import { referencesHandler } from "../references"

vi.mock("../../references/collectMediaReferences", () => ({
  collectMediaReferences: vi.fn(),
}))

const payload = { find: vi.fn() }

const request = (user: Partial<User> | null, routeParams: { id?: string } = { id: "42" }) =>
  ({ user, payload, routeParams }) as unknown as PayloadRequest

const editor = { id: 1, roles: ["editor"] } as Partial<User>

beforeEach(() => {
  vi.mocked(collectMediaReferences).mockReset()
})

describe("referencesHandler", () => {
  it("lists a staff member the references for the media", async () => {
    const references = [
      { collection: "articles", field: "heroImage", docId: 7, docTitle: "Hero", docSlug: "hero" },
    ]
    vi.mocked(collectMediaReferences).mockResolvedValue(references)

    const response = await referencesHandler(request(editor))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ references })
    expect(collectMediaReferences).toHaveBeenCalledWith(payload, 42)
  })

  it.each(["writer", "narrator", "chief-editor", "admin"])("allows a %s", async (role) => {
    vi.mocked(collectMediaReferences).mockResolvedValue([])

    const response = await referencesHandler(request({ id: 2, roles: [role] } as Partial<User>))

    expect(response.status).toBe(200)
  })

  it("rejects an anonymous request without looking anything up", async () => {
    const response = await referencesHandler(request(null))

    expect(response.status).toBe(401)
    expect(collectMediaReferences).not.toHaveBeenCalled()
  })

  it("rejects a member, who isn't staff", async () => {
    const response = await referencesHandler(request({ id: 3, roles: ["member"] } as Partial<User>))

    expect(response.status).toBe(403)
    await expect(response.json()).resolves.toEqual({ error: "Forbidden" })
    expect(collectMediaReferences).not.toHaveBeenCalled()
  })

  it.each([
    ["a non-numeric id", { id: "abc" }],
    ["a missing id", {}],
  ])("rejects %s", async (_, routeParams) => {
    const response = await referencesHandler(request(editor, routeParams))

    expect(response.status).toBe(400)
    expect(collectMediaReferences).not.toHaveBeenCalled()
  })
})
