import type { CollectionConfig, Config, Endpoint, PayloadRequest } from "payload"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { READS_SLUG } from "../constants"
import { deleteArticlesReads, deleteUsersReads } from "../hooks/deleteReads"
import { type ReadingUser, readingHistoryPlugin, resolveReadingHistoryConfig } from "../index"
import { fakePayload } from "./fakePayload"

const users: CollectionConfig = { slug: "users", fields: [] }
const articles: CollectionConfig = { slug: "articles", fields: [] }
const base: Config = { collections: [users, articles], endpoints: [] } as unknown as Config

const install = async (options: Parameters<typeof readingHistoryPlugin>[0]) =>
  (await readingHistoryPlugin(options)(base)) as Config

describe("readingHistoryPlugin", () => {
  const options = { currentUser: async () => null }

  it("adds the reads, the visits on each user, and the endpoints", async () => {
    const config = await install(options)
    const slugs = config.collections!.map((collection) => collection.slug)
    expect(slugs).toEqual(["users", "articles", READS_SLUG])

    const usersAfter = config.collections!.find((c) => c.slug === "users")!
    expect(usersAfter.fields).toEqual([expect.objectContaining({ name: "reading" })])
    expect(usersAfter.hooks?.beforeDelete).toEqual([deleteUsersReads])
    expect(config.collections!.find((c) => c.slug === "articles")!.hooks?.beforeDelete).toEqual([
      deleteArticlesReads,
    ])
    expect(config.endpoints!.map((e) => `${e.method} ${e.path}`)).toEqual([
      "post /reading",
      "get /reading/mine",
    ])
  })

  it("keeps its schema, and nothing else, when it's disabled", async () => {
    const config = await install({ ...options, disabled: true })
    const usersAfter = config.collections!.find((c) => c.slug === "users")!
    expect(usersAfter.fields).toEqual([expect.objectContaining({ name: "reading" })])
    expect(usersAfter.hooks?.beforeDelete).toBeUndefined()
    expect(config.collections!.map((c) => c.slug)).toContain(READS_SLUG)
    expect(config.endpoints).toEqual([])
  })

  it("lets only the plugin write reads, and nobody read them unless the site says", async () => {
    const config = await install(options)
    const reads = config.collections!.find((c) => c.slug === READS_SLUG)!
    const req = {} as never
    for (const operation of ["read", "create", "update", "delete"] as const) {
      expect(await reads.access![operation]!({ req })).toBe(false)
    }
    expect(reads.indexes).toEqual([{ fields: ["user", "article"], unique: true }])
  })
})

describe("deleting", () => {
  it("an account deletes its reads, and an article deletes its own", async () => {
    const { payload, store } = fakePayload({
      reads: [
        { id: 1, user: 1, article: 10 },
        { id: 2, user: 1, article: 11 },
        { id: 3, user: 2, article: 10 },
      ],
    })
    const req = { payload } as unknown as PayloadRequest
    await deleteUsersReads({ id: 1, req } as never)
    expect(store[READS_SLUG]).toEqual([{ id: 3, user: 2, article: 10 }])
    await deleteArticlesReads({ id: 10, req } as never)
    expect(store[READS_SLUG]).toEqual([])
  })
})

describe("the endpoints", () => {
  const now = Date.parse("2026-11-08T18:00:00Z")
  let signedIn: ReadingUser | null
  let on: boolean
  const config = resolveReadingHistoryConfig({
    enabled: async () => on,
    currentUser: async () => signedIn,
  })
  let fake: ReturnType<typeof fakePayload>

  beforeEach(() => {
    vi.useFakeTimers({ now, toFake: ["Date"] })
    on = true
    fake = fakePayload({
      users: [{ id: 1 }],
      articles: [{ id: 10, _status: "published" }],
    })
    signedIn = fake.store.users![0]!
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  const endpoint = async (method: string, path: string): Promise<Endpoint> =>
    (
      await readingHistoryPlugin({ enabled: async () => on, currentUser: async () => signedIn })(
        base,
      )
    ).endpoints!.find((e) => e.method === method && e.path === path)!

  const call = async (method: "post" | "get", path: string, body?: unknown) =>
    (await endpoint(method, path)).handler({
      payload: fake.payload,
      json: async () => {
        if (body === "not json") throw new SyntaxError("Unexpected token")
        return body
      },
    } as unknown as PayloadRequest)

  it("records a visit, and a read with it", async () => {
    const response = await call("post", "/reading", { day: "2026-11-08", article: "10" })
    expect(response.status).toBe(204)
    expect(response.headers.get("Cache-Control")).toBe("private, no-store")
    expect(fake.store[READS_SLUG]).toEqual([expect.objectContaining({ user: 1, article: 10 })])
    expect(signedIn!.reading).toMatchObject({ daysVisited: 1, lastVisitOn: "2026-11-08" })
  })

  it("turns away a day that isn't today anywhere, a bad article and a bad body", async () => {
    expect((await call("post", "/reading", { day: "2026-11-01" })).status).toBe(400)
    expect((await call("post", "/reading", { day: "2026-11-08", article: "x" })).status).toBe(400)
    expect((await call("post", "/reading", "not json")).status).toBe(400)
    expect(fake.store[READS_SLUG]).toEqual([])
  })

  it("keeps nothing for someone signed out, or while it's off", async () => {
    signedIn = null
    expect((await call("post", "/reading", { day: "2026-11-08" })).status).toBe(401)
    expect((await call("get", "/reading/mine")).status).toBe(401)
    signedIn = fake.store.users![0]!
    on = false
    expect((await call("post", "/reading", { day: "2026-11-08" })).status).toBe(404)
    expect((await call("get", "/reading/mine")).status).toBe(404)
    expect(fake.payload.db.updateOne).not.toHaveBeenCalled()
  })

  it("answers the reader's totals", async () => {
    await call("post", "/reading", { day: "2026-11-08", article: 10 })
    const response = await call("get", "/reading/mine")
    expect(response.headers.get("Cache-Control")).toBe("private, no-store")
    expect(await response.json()).toEqual({
      articlesRead: 1,
      volumesRead: null,
      daysVisited: 1,
      currentStreak: 1,
      longestStreak: 1,
    })
    expect(config.usersSlug).toBe("users")
  })
})
