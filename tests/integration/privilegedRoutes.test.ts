import config from "@payload-config"
import { NextRequest } from "next/server"
import { handleEndpoints, type Payload } from "payload"
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest"

import * as emailPreviewRoute from "@/app/(frontend)/email-preview/[volume]/[day]/route"
import * as seedRoute from "@/app/(frontend)/next/seed/route"
import type { User } from "@/payload-types"
import { createArticle, createVolume } from "./helpers/content"
import { createUser, getPayload, type Role } from "./helpers/testUsers"

// The routes that act with more than a reader's rights: `/next/seed` deletes every
// article, volume, page and media file, and the email preview renders unpublished
// volumes. Each is checked here for who it turns away. The seed route's success path is
// left alone on purpose: it would wipe the shared test database.

let payload: Payload
const tokens = new Map<Role, string>()
let editor: User

beforeAll(async () => {
  payload = await getPayload()
  for (const role of ["admin", "editor", "writer"] as const) {
    const user = await createUser(role)
    if (role === "editor") editor = user
    const login = await payload.login({
      collection: "users",
      data: { email: user.email, password: "test-password" },
    })
    tokens.set(role, login.token!)
  }
})

afterEach(() => {
  vi.unstubAllEnvs()
})

const authHeaders = (role?: Role): HeadersInit =>
  role ? { Authorization: `JWT ${tokens.get(role)}` } : {}

describe("POST /next/seed", () => {
  const seed = (role?: Role) =>
    seedRoute.POST(
      new NextRequest("http://localhost/next/seed", { method: "POST", headers: authHeaders(role) }),
    )

  it.each([undefined, "writer", "editor"] as const)("refuses %s", async (role) => {
    const response = await seed(role)
    expect(response.status).toBe(403)
    expect(await response.json()).toEqual({
      error: "Unauthorized. Only admins can seed the database.",
    })
  })

  it("refuses everyone in production, admins included", async () => {
    vi.stubEnv("NODE_ENV", "production")
    const response = await seed("admin")
    expect(response.status).toBe(403)
    expect(await response.json()).toEqual({ error: "Seeding is not allowed in production" })
  })
})

describe("GET /email-preview/:volume/:day", () => {
  const preview = (role: Role | undefined, volume: string | number, day: string | number) =>
    emailPreviewRoute.GET(
      new NextRequest(`http://localhost/email-preview/${volume}/${day}`, {
        headers: authHeaders(role),
      }),
      { params: Promise.resolve({ volume: String(volume), day: String(day) }) },
    )

  let volumeId: number
  let articleTitle: string

  beforeAll(async () => {
    const article = await createArticle({ authors: [editor.id], title: "Email preview article" })
    articleTitle = article.title
    const volume = await createVolume({ articles: [article.id], _status: "draft" })
    volumeId = volume.id
  })

  it.each([undefined, "writer"] as const)("refuses %s", async (role) => {
    const response = await preview(role, volumeId, 0)
    expect(response.status).toBe(401)
  })

  it("renders a draft volume's article email for an editor", async () => {
    const response = await preview("editor", volumeId, 0)
    expect(response.status).toBe(200)
    expect(response.headers.get("content-type")).toContain("text/html")
    expect(await response.text()).toContain(articleTitle)
  })

  it("answers 400 for a volume id that isn't a number", async () => {
    const response = await preview("editor", "abc", 0)
    expect(response.status).toBe(400)
    expect(await response.text()).toBe("Invalid volume id")
  })

  it("answers 400 for a day past the volume's last article", async () => {
    const response = await preview("editor", volumeId, 5)
    expect(response.status).toBe(400)
    expect(await response.text()).toBe("Invalid day index")
  })
})

describe("POST /api/media/:id/regenerate-blur", () => {
  const regenerate = (role: Role | undefined, id: string) =>
    handleEndpoints({
      config,
      request: new Request(`http://localhost/api/media/${id}/regenerate-blur`, {
        method: "POST",
        headers: authHeaders(role),
      }),
    })

  it("refuses a signed-out request", async () => {
    const response = await regenerate(undefined, "1")
    expect(response.status).toBe(401)
  })

  it("answers 400 for an id that isn't a number", async () => {
    const response = await regenerate("writer", "abc")
    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: "Invalid ID" })
  })
})
