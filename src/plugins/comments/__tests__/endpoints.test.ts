import type { PayloadRequest } from "payload"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { COMMENTS_SLUG, DEFAULT_SETTINGS, SETTINGS_SLUG, VIOLATIONS_SLUG } from "../constants"
import { isCakeDay, THREAD_LIMIT, threadEndpoints } from "../endpoints/thread"
import { SKIP_MODERATION } from "../hooks/recordModeration"
import type { ResolvedCommentsConfig } from "../types"

const site = "https://example.com"
const DAY_MS = 24 * 60 * 60 * 1000
const ada = { id: 7, name: "Ada" }

const enabled = vi.fn()
const currentUser = vi.fn()
const isVerified = vi.fn()
const extraCheck = vi.fn()
const authorBadges = vi.fn()
const targetWriters = vi.fn()

const config = {
  enabled,
  currentUser,
  isVerified,
  targetSlug: "articles",
  authorsSlug: "users",
  authorFields: ["name"],
  describeAuthor: (author: Record<string, unknown>) => ({
    name: String(author.name),
    image: null,
    badge: author.staff ? "Staff" : null,
  }),
  authorBadges,
  targetWriters,
  signInProviders: () => [{ id: "discord", label: "Discord" }],
  baseURL: () => site,
  checks: [extraCheck],
  maxLength: 2000,
  cooldownSeconds: 10,
  newCommenterDays: 7,
  newMemberDays: 30,
} as unknown as ResolvedCommentsConfig

const [get, post] = threadEndpoints(config)

/** What the fake database holds for one test. */
let db: {
  settings: Record<string, unknown>
  comments: Record<string, unknown>[]
  violations: Record<string, unknown>[]
  target: unknown
  parent: unknown
  recent: number
  /** Published comments each author made before the New commenter window, by author ID. */
  earlier: Record<string, number>
  /** Published comments each author made before their earliest one in the thread, by author ID. */
  before: Record<string, number>
}

const payload = {
  db: { defaultIDType: "number" },
  find: vi.fn(async ({ collection }: { collection: string }) => ({
    docs: collection === VIOLATIONS_SLUG ? db.violations : db.comments,
  })),
  findGlobal: vi.fn(async () => db.settings),
  findByID: vi.fn(async ({ collection }: { collection: string }) =>
    collection === COMMENTS_SLUG ? db.parent : db.target,
  ),
  // The cooldown counts recent comments. The New commenter and First comment marks count
  // published ones before a time: the window's start (within the last weeks), or a comment's.
  count: vi.fn(async ({ where }: { where: Record<string, Record<string, unknown>> }) => {
    if (!where.status) return { totalDocs: db.recent }
    const author = String(where.author!.equals)
    const inWindow = Date.parse(String(where.createdAt!.less_than)) > Date.now() - 8 * DAY_MS
    return { totalDocs: (inWindow ? db.earlier[author] : db.before[author]) ?? 0 }
  }),
  create: vi.fn(async ({ collection, data }: { collection: string; data: object }) => ({
    id: collection === COMMENTS_SLUG ? 99 : 1,
    createdAt: "2026-10-13T12:00:00.000Z",
    ...data,
  })),
}

function call(
  endpoint: typeof get,
  { id = "5", body, origin = site }: { id?: string; body?: unknown; origin?: string | null } = {},
) {
  const headers = new Headers(origin ? { origin } : {})
  return endpoint!.handler({
    payload,
    headers,
    routeParams: { id },
    json: async () => body,
  } as unknown as PayloadRequest)
}

const json = async (response: Response) => (await response.json()) as Record<string, unknown>

beforeEach(() => {
  vi.clearAllMocks()
  enabled.mockResolvedValue(true)
  currentUser.mockResolvedValue(ada)
  isVerified.mockReturnValue(true)
  extraCheck.mockResolvedValue({ ok: true })
  authorBadges.mockResolvedValue(new Map())
  targetWriters.mockResolvedValue([])
  db = {
    settings: {},
    comments: [],
    violations: [],
    target: { id: 5 },
    parent: null,
    recent: 0,
    earlier: {},
    before: {},
  }
})

describe("GET /thread/:id", () => {
  it("answers 404 while comments are off, or for an id that isn't one", async () => {
    expect((await call(get, { id: "abc" })).status).toBe(404)
    expect((await call(get, { id: "-1" })).status).toBe(404)
    enabled.mockResolvedValue(false)
    expect((await call(get)).status).toBe(404)
    expect(payload.find).not.toHaveBeenCalled()
  })

  it("lists the document's comments for a signed-out reader, with the ways to sign in", async () => {
    currentUser.mockResolvedValue(null)
    db.comments = [
      {
        id: 1,
        body: "First",
        status: "published",
        depth: 0,
        parent: null,
        createdAt: "2026-10-13T10:00:00.000Z",
        author: ada,
      },
    ]

    const response = await call(get)

    expect(response.status).toBe(200)
    expect(response.headers.get("Cache-Control")).toBe("private, no-store")
    expect(await json(response)).toEqual({
      comments: [expect.objectContaining({ id: 1, body: "First", author: expect.anything() })],
      viewer: null,
      providers: [{ id: "discord", label: "Discord" }],
      maxDepth: DEFAULT_SETTINGS.maxDepth,
      maxLength: 2000,
      truncated: false,
    })
    expect(payload.find).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: COMMENTS_SLUG,
        where: { target: { equals: 5 } },
        sort: "-createdAt",
        limit: THREAD_LIMIT,
        populate: { users: { name: true, createdAt: true } },
      }),
    )
  })

  it("describes a signed-in viewer, their lock and whether they need a verified address", async () => {
    db.settings = { requireVerifiedEmail: true, maxDepth: 2 }
    db.violations = [{ source: "block", createdAt: "2026-01-01T00:00:00.000Z" }]
    isVerified.mockReturnValue(false)

    const body = await json(await call(get))

    expect(body.viewer).toEqual({
      name: "Ada",
      image: null,
      badge: null,
      locked: { until: null },
      needsVerifiedEmail: true,
    })
    expect(body.providers).toEqual([])
    expect(body.maxDepth).toBe(2)
  })
})

describe("badges from outside the plugin", () => {
  const grace = { id: 8, name: "Grace", staff: true }
  const comment = (id: number, author: object) => ({
    id,
    body: "Hi",
    status: "published",
    depth: 0,
    parent: null,
    createdAt: "2026-10-13T10:00:00.000Z",
    author,
  })

  it("asks once for every author shown and the viewer, and shows each one's badge", async () => {
    db.comments = [comment(2, grace), comment(1, ada)]
    authorBadges.mockResolvedValue(
      new Map([
        ["7", "Early member"],
        ["8", "Verified"],
      ]),
    )

    const body = await json(await call(get))

    expect(authorBadges).toHaveBeenCalledOnce()
    expect(authorBadges.mock.calls[0]![0]).toEqual([ada, grace, ada])
    const comments = body.comments as { author: { badge: string | null } }[]
    // Staff wins over a badge from outside.
    expect(comments.map((c) => c.author.badge)).toEqual(["Early member", "Staff"])
    expect(body.viewer).toMatchObject({ badge: "Early member" })
  })

  it("marks the comments of the document's writers", async () => {
    db.comments = [comment(2, grace), comment(1, ada)]
    targetWriters.mockResolvedValue([8])

    const body = await json(await call(get))

    expect(targetWriters).toHaveBeenCalledOnce()
    expect(targetWriters.mock.calls[0]![0]).toBe(5)
    const comments = body.comments as { author: { writer?: true } }[]
    expect(comments.map((c) => c.author.writer)).toEqual([undefined, true])
  })

  it("marks a writer's comment as theirs as soon as they post it", async () => {
    targetWriters.mockResolvedValue([7])

    const response = await call(post, { body: { body: "Thanks for reading." } })

    expect(((await json(response)).comment as { author: object }).author).toMatchObject({
      writer: true,
    })
  })

  it("shows the author's badge on the comment they just posted", async () => {
    authorBadges.mockResolvedValue(new Map([["7", "Verified"]]))

    const response = await call(post, { body: { body: "Hello" } })

    expect(((await json(response)).comment as { author: object }).author).toMatchObject({
      badge: "Verified",
    })
  })
})

describe("new commenters", () => {
  const grace = { id: 8, name: "Grace" }
  const comment = (id: number, author: object, status = "published") => ({
    id,
    body: "Hi",
    status,
    depth: 0,
    parent: null,
    createdAt: `2026-10-13T1${id}:00:00.000Z`,
    author,
  })
  const marks = (body: Record<string, unknown>) =>
    (body.comments as { id: number; author: { newcomer?: true } | null }[]).map((c) => [
      c.id,
      c.author?.newcomer,
    ])

  it("marks every comment of an author with nothing published before the window", async () => {
    // Newest first, as the database answers.
    db.comments = [comment(3, ada), comment(2, grace), comment(1, ada)]
    db.earlier = { "8": 4 }

    const body = await json(await call(get))

    expect(marks(body)).toEqual([
      [1, true],
      [2, undefined],
      [3, true],
    ])
    expect(body.viewer).toMatchObject({ newcomer: true })
    // One count per author: their published comments from before the last 7 days.
    const windowCounts = payload.count.mock.calls
      .map(([args]) => args.where)
      .filter((where) => Date.parse(String(where.createdAt!.less_than)) > Date.now() - 8 * DAY_MS)
    expect(windowCounts).toHaveLength(2)
    const cutoff = Date.parse(String(windowCounts[0]!.createdAt!.less_than))
    expect(Date.now() - cutoff).toBeCloseTo(7 * DAY_MS, -4)
    expect(windowCounts[0]).toMatchObject({
      author: { equals: "7" },
      status: { equals: "published" },
    })
  })

  it("doesn't mark an author whose only comments are held", async () => {
    db.comments = [comment(1, grace, "auto-hidden")]
    currentUser.mockResolvedValue(grace)

    const body = await json(await call(get))

    expect(marks(body)).toEqual([[1, undefined]])
    expect(payload.count).not.toHaveBeenCalled()
  })

  it("marks a reader's comment as soon as they post their first", async () => {
    const first = await json(await call(post, { body: { body: "Hello" } }))
    expect((first.comment as { author: object }).author).toMatchObject({ newcomer: true })

    db.earlier = { "7": 1 }
    const later = await json(await call(post, { body: { body: "Back again" } }))
    expect((later.comment as { author: object }).author).not.toHaveProperty("newcomer")
  })

  it("marks nobody when the window is 0 days", async () => {
    const [off] = threadEndpoints({ ...config, newCommenterDays: 0 })
    db.comments = [comment(1, ada)]

    const response = await off!.handler({
      payload,
      headers: new Headers({ origin: site }),
      routeParams: { id: "5" },
    } as unknown as PayloadRequest)

    expect(marks(await json(response))).toEqual([[1, undefined]])
  })
})

describe("first comments", () => {
  const grace = { id: 8, name: "Grace" }
  const comment = (id: number, author: object, status = "published") => ({
    id,
    body: "Hi",
    status,
    depth: 0,
    parent: null,
    createdAt: `2026-10-13T1${id}:00:00.000Z`,
    author,
  })
  const firsts = (body: Record<string, unknown>) =>
    (body.comments as { id: number; firstComment?: true }[]).map((c) => [c.id, c.firstComment])

  it("marks each author's earliest comment here when they published nothing before it", async () => {
    db.comments = [comment(3, ada), comment(2, grace), comment(1, ada)]
    db.before = { "8": 4 }

    const body = await json(await call(get))

    expect(firsts(body)).toEqual([
      [1, true],
      [2, undefined],
      [3, undefined],
    ])
    expect(payload.count.mock.calls.map(([args]) => args.where)).toContainEqual({
      author: { equals: "7" },
      status: { equals: "published" },
      createdAt: { less_than: "2026-10-13T11:00:00.000Z" },
    })
  })

  it("doesn't count a held comment as anyone's first", async () => {
    db.comments = [comment(2, ada), comment(1, ada, "auto-hidden")]

    const body = await json(await call(get))

    expect(firsts(body)).toEqual([
      [1, undefined],
      [2, true],
    ])
  })

  it("marks a reader's first comment as soon as they post it, and not a later one", async () => {
    const first = await json(await call(post, { body: { body: "Hello" } }))
    expect(first.comment).toMatchObject({ firstComment: true })

    db.before = { "7": 1 }
    const later = await json(await call(post, { body: { body: "Hello again" } }))
    expect(later.comment).not.toHaveProperty("firstComment")
  })
})

describe("new members", () => {
  const joined = (daysAgo: number) => new Date(Date.now() - daysAgo * DAY_MS).toISOString()
  const comment = (id: number, author: object) => ({
    id,
    body: "Hi",
    status: "published",
    depth: 0,
    parent: null,
    createdAt: `2026-10-13T1${id}:00:00.000Z`,
    author,
  })

  it("marks authors whose account is under 30 days old, and reads when each joined", async () => {
    currentUser.mockResolvedValue(null)
    db.comments = [
      comment(3, { id: 9, name: "Old", createdAt: joined(400) }),
      comment(2, { id: 8, name: "Recent", createdAt: joined(29) }),
      comment(1, { id: 7, name: "Unknown" }),
    ]

    const body = await json(await call(get))

    const comments = body.comments as { author: { name: string; newMember?: true } }[]
    expect(comments.map((c) => [c.author.name, c.author.newMember])).toEqual([
      ["Unknown", undefined],
      ["Recent", true],
      ["Old", undefined],
    ])
    const populate = payload.find.mock.calls[0]![0] as unknown as {
      populate: Record<string, Record<string, true>>
    }
    expect(populate.populate.users).toMatchObject({ name: true, createdAt: true })
  })

  it("marks nobody when the window is 0 days", async () => {
    const [off] = threadEndpoints({ ...config, newMemberDays: 0 })
    currentUser.mockResolvedValue(null)
    db.comments = [comment(1, { id: 8, name: "Recent", createdAt: joined(1) })]

    const response = await off!.handler({
      payload,
      headers: new Headers({ origin: site }),
      routeParams: { id: "5" },
    } as unknown as PayloadRequest)

    const comments = (await json(response)).comments as { author: object }[]
    expect(comments[0]!.author).not.toHaveProperty("newMember")
  })
})

describe("cake day", () => {
  const on = (iso: string) => new Date(iso)

  it("falls on each anniversary of the account, from its first year on", () => {
    expect(isCakeDay("2025-11-09T23:00:00.000Z", on("2026-11-09T01:00:00.000Z"))).toBe(true)
    expect(isCakeDay(new Date("2020-03-15T00:00:00.000Z"), on("2026-03-15T12:00:00.000Z"))).toBe(
      true,
    )
  })

  it("isn't the day the account was made, or any other day", () => {
    expect(isCakeDay("2026-11-09T01:00:00.000Z", on("2026-11-09T12:00:00.000Z"))).toBe(false)
    expect(isCakeDay("2025-11-09T00:00:00.000Z", on("2026-11-10T00:00:00.000Z"))).toBe(false)
    expect(isCakeDay("2025-12-09T00:00:00.000Z", on("2026-11-09T00:00:00.000Z"))).toBe(false)
  })

  it("moves a 29 February account to the 28th outside leap years", () => {
    expect(isCakeDay("2024-02-29T00:00:00.000Z", on("2025-02-28T00:00:00.000Z"))).toBe(true)
    expect(isCakeDay("2024-02-29T00:00:00.000Z", on("2028-02-28T00:00:00.000Z"))).toBe(false)
    expect(isCakeDay("2024-02-29T00:00:00.000Z", on("2028-02-29T00:00:00.000Z"))).toBe(true)
  })

  it("isn't anyone's without a readable date", () => {
    expect(isCakeDay(undefined)).toBe(false)
    expect(isCakeDay("soon")).toBe(false)
  })

  it("marks an author on their cake day in the thread", async () => {
    currentUser.mockResolvedValue(null)
    const now = new Date()
    const yearAgo = new Date(now)
    yearAgo.setUTCFullYear(now.getUTCFullYear() - 1)
    db.comments = [
      {
        id: 1,
        body: "Hi",
        status: "published",
        depth: 0,
        parent: null,
        createdAt: "2026-10-13T10:00:00.000Z",
        author: { id: 8, name: "Grace", createdAt: yearAgo.toISOString() },
      },
    ]

    const body = await json(await call(get))

    expect((body.comments as { author: object }[])[0]!.author).toMatchObject({ cakeDay: true })
  })
})

describe("a thread past the limit", () => {
  it("shows its newest comments, oldest first, and says older ones were left out", async () => {
    currentUser.mockResolvedValue(null)
    const comment = (id: number) => ({
      id,
      body: `#${id}`,
      status: "published",
      depth: 0,
      parent: null,
      createdAt: `2026-10-13T1${id}:00:00.000Z`,
      author: ada,
    })
    payload.find.mockResolvedValueOnce({ docs: [comment(3), comment(2)], totalDocs: 3 } as never)

    const body = await json(await call(get))

    expect((body.comments as { id: number }[]).map(({ id }) => id)).toEqual([2, 3])
    expect(body.truncated).toBe(true)
  })
})

describe("POST /thread/:id", () => {
  const send = (body: unknown, options: { origin?: string | null } = {}) =>
    call(post, { body, ...options })

  it("refuses a post from another site, or with no origin", async () => {
    expect((await send({ body: "Hi" }, { origin: "https://evil.test" })).status).toBe(403)
    expect((await send({ body: "Hi" }, { origin: null })).status).toBe(403)
    expect(currentUser).not.toHaveBeenCalled()
  })

  it("answers 404 while comments are off, or for an id that isn't one", async () => {
    expect((await call(post, { id: "0", body: { body: "Hi" } })).status).toBe(404)
    enabled.mockResolvedValue(false)
    expect((await send({ body: "Hi" })).status).toBe(404)
  })

  it("asks a signed-out reader to sign in", async () => {
    currentUser.mockResolvedValue(null)
    const response = await send({ body: "Hi" })
    expect(response.status).toBe(401)
    expect((await json(response)).message).toBe("Sign in to comment.")
  })

  it("refuses a locked author, saying until when", async () => {
    db.violations = [
      { source: "check", createdAt: new Date().toISOString() },
      { source: "check", createdAt: new Date().toISOString() },
      { source: "check", createdAt: new Date().toISOString() },
    ]
    const response = await send({ body: "Hi" })
    expect(response.status).toBe(403)
    const body = await json(response)
    expect(body.message).toMatch(/too many of its comments/)
    expect(typeof body.lockedUntil).toBe("string")
  })

  it("refuses a blocked author", async () => {
    db.violations = [{ source: "block", createdAt: "2026-01-01T00:00:00.000Z" }]
    const body = await json(await send({ body: "Hi" }))
    expect(body).toEqual({
      message: "A moderator has stopped this account from commenting.",
      lockedUntil: null,
    })
  })

  it("needs a verified address only while the setting is on", async () => {
    isVerified.mockReturnValue(false)
    expect((await send({ body: "Hi" })).status).toBe(201)

    db.settings = { requireVerifiedEmail: true }
    const refused = await send({ body: "Hi" })
    expect(refused.status).toBe(403)
    expect((await json(refused)).message).toMatch(/verified email/)
  })

  it("refuses an empty body, or one that isn't JSON", async () => {
    expect((await send({ body: "   " })).status).toBe(400)
    expect((await send(null)).status).toBe(400)
  })

  it("answers 404 for a document readers can't see", async () => {
    db.target = null
    expect((await send({ body: "Hi" })).status).toBe(404)
  })

  it("posts a published comment, and skips the moderation hook", async () => {
    const response = await send({ body: "  Thanks  " })

    expect(response.status).toBe(201)
    expect(await json(response)).toEqual({
      comment: expect.objectContaining({ id: 99, body: "Thanks", depth: 0, parentId: null }),
    })
    expect(payload.create).toHaveBeenCalledTimes(1)
    expect(payload.create).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: COMMENTS_SLUG,
        data: expect.objectContaining({ status: "published", target: 5, author: 7, depth: 0 }),
        context: { [SKIP_MODERATION]: true },
      }),
    )
  })

  it("holds a comment that fails a check, and records the violation", async () => {
    extraCheck.mockResolvedValue({ ok: false, reason: "Looks like spam" })

    const response = await send({ body: "Buy now" })

    expect(response.status).toBe(201)
    expect(await json(response)).toEqual({
      comment: expect.objectContaining({ id: 99, held: true }),
      held: "Looks like spam",
    })
    expect(payload.create).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: COMMENTS_SLUG,
        data: expect.objectContaining({
          status: "auto-hidden",
          moderationReason: "Looks like spam",
        }),
      }),
    )
    expect(payload.create).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: VIOLATIONS_SLUG,
        data: { author: 7, comment: 99, source: "check", reason: "Looks like spam" },
      }),
    )
  })

  it("slows down an author who just commented", async () => {
    db.recent = 1
    const response = await send({ body: "Again" })
    expect(response.status).toBe(429)
    expect(response.headers.get("Retry-After")).toBe("10")
    expect(payload.create).not.toHaveBeenCalled()
  })

  describe("a reply", () => {
    it("goes one level below a published comment on the same document", async () => {
      db.parent = { target: 5, status: "published", depth: 1 }

      const response = await send({ body: "Agreed", parentId: 3 })

      expect(response.status).toBe(201)
      expect(payload.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ parent: 3, depth: 2 }) }),
      )
    })

    it("is refused under a comment that's gone, hidden or on another document", async () => {
      for (const parent of [
        null,
        { target: 5, status: "hidden", depth: 0 },
        { target: 6, status: "published", depth: 0 },
      ]) {
        db.parent = parent
        const response = await send({ body: "Hm", parentId: 3 })
        expect(response.status).toBe(400)
        expect((await json(response)).message).toMatch(/no longer there/)
      }
      expect((await send({ body: "Hm", parentId: "x" })).status).toBe(400)
    })

    it("is refused past the reply depth, which can switch replies off", async () => {
      db.parent = { target: 5, status: "published", depth: 1 }
      db.settings = { maxDepth: 1 }
      expect((await json(await send({ body: "Deep", parentId: 3 }))).message).toBe(
        "Replies are limited to 1 levels here.",
      )

      db.parent = { target: 5, status: "published" }
      db.settings = { maxDepth: 0 }
      expect((await json(await send({ body: "Deep", parentId: 3 }))).message).toBe(
        "Replies are off here.",
      )
    })
  })
})

describe("readSettings", () => {
  it("fills in whatever an admin hasn't saved", async () => {
    db.settings = { maxDepth: 3, blockDuplicates: false, maxLinks: "x" }
    await call(get)
    expect(payload.findGlobal).toHaveBeenCalledWith(
      expect.objectContaining({ slug: SETTINGS_SLUG, overrideAccess: true }),
    )
    const { readSettings } = await import("../settings")
    expect(await readSettings(payload as never)).toEqual({
      ...DEFAULT_SETTINGS,
      maxDepth: 3,
      blockDuplicates: false,
    })
  })
})
