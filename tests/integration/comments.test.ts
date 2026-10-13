import config from "@payload-config"
import { handleEndpoints, type Payload } from "payload"
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"

import type { CommentThread, PublicComment } from "@/plugins/comments"
import { getSiteURL } from "@/utilities/getURL"
import type { Article } from "@/payload-types"
import { createArticle } from "./helpers/content"
import { createUser, getPayload } from "./helpers/testUsers"

// A reader signs up with Discord (stubbed: the token exchange and the profile are answered
// here) as the comment box does, then reads and posts comments through the endpoints,
// against the real database.

vi.mock("next/headers", () => ({
  cookies: () => Promise.reject(new Error("no request scope")),
}))

let payload: Payload
const site = getSiteURL()

interface DiscordProfile {
  id: string
  email: string
  verified: boolean
  global_name?: string
}

function stubDiscord(profile: DiscordProfile) {
  vi.stubGlobal("fetch", (input: RequestInfo | URL) => {
    const url = String(input instanceof Request ? input.url : input)
    if (url.startsWith("https://discord.com/api/oauth2/token")) {
      return Promise.resolve(
        Response.json({ access_token: "access", token_type: "Bearer", expires_in: 3600 }),
      )
    }
    if (url.startsWith("https://discord.com/api/users/")) {
      return Promise.resolve(
        Response.json({
          global_name: "Reader One",
          ...profile,
          username: "reader",
          discriminator: "0",
          avatar: null,
        }),
      )
    }
    return Promise.reject(new Error(`unexpected request to ${url}`))
  })
}

/** `name=value` pairs from a response's Set-Cookie headers, for the next request. */
function cookiesFrom(response: Response): string {
  return response.headers
    .getSetCookie()
    .map((cookie) => cookie.split(";")[0])
    .filter((pair) => !pair?.endsWith("="))
    .join("; ")
}

const api = (path: string, init: RequestInit = {}) =>
  handleEndpoints({
    config,
    request: new Request(`${site}/api${path}`, {
      ...init,
      headers: { Origin: site, ...init.headers },
    }),
  })

/** Signs a reader up (or in) with Discord as `profile`, and returns their cookie. */
async function signIn(profile: DiscordProfile): Promise<string> {
  stubDiscord(profile)
  const start = await api("/auth/sign-in/social", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      provider: "discord",
      requestSignUp: true,
      callbackURL: "/articles/x#comments",
    }),
  })
  expect(start.status).toBe(200)
  const { url } = (await start.json()) as { url: string }
  const state = new URL(url).searchParams.get("state")
  const callback = await api(`/auth/callback/discord?code=test-code&state=${state}`, {
    headers: { Cookie: cookiesFrom(start) },
  })
  expect(callback.status).toBe(302)
  expect(callback.headers.get("location")).toBe("/articles/x#comments")
  return cookiesFrom(callback)
}

const thread = async (article: Article, cookie = ""): Promise<CommentThread> => {
  const response = await api(`/comments/thread/${article.id}`, { headers: { Cookie: cookie } })
  expect(response.status).toBe(200)
  return (await response.json()) as CommentThread
}

const post = (
  article: Article | { id: number },
  cookie: string,
  body: unknown,
  parentId?: number | string,
) =>
  api(`/comments/thread/${article.id}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({ body, parentId }),
  })

/** Posts and returns the comment, waiting out the cooldown first. */
async function posted(
  article: Article,
  cookie: string,
  body: string,
  parentId?: number | string,
): Promise<{ comment: PublicComment; held?: string }> {
  const response = await post(article, cookie, body, parentId)
  expect(response.status, await response.clone().text()).toBe(201)
  return (await response.json()) as { comment: PublicComment; held?: string }
}

const setExperiment = (comments: boolean) =>
  payload.updateGlobal({
    slug: "site-settings",
    data: { experiments: { sso: true, comments } },
    context: { disableRevalidate: true },
  })

const setSettings = (data: Record<string, unknown>) =>
  payload.updateGlobal({ slug: "comment-settings", data })

// Discord's default picture, which Better Auth gives a profile with no avatar of its own.
const DEFAULT_AVATAR = "https://cdn.discordapp.com/embed/avatars/0.png"

const uniqueEmail = () => `reader-${crypto.randomUUID().slice(0, 8)}@example.com`
let discordId = 5000
const nextDiscordId = () => String(++discordId)

let article: Article

beforeAll(async () => {
  payload = await getPayload()
  const writer = await createUser("writer")
  article = await createArticle({ authors: [writer.id] })
})

beforeEach(async () => {
  vi.stubEnv("DISCORD_CLIENT_ID", "discord-client")
  vi.stubEnv("DISCORD_CLIENT_SECRET", "discord-secret")
  await setExperiment(true)
  await setSettings({
    maxDepth: 5,
    violationThreshold: 3,
    violationWindowDays: 30,
    maxLinks: 2,
    blockDuplicates: true,
    requireVerifiedEmail: false,
  })
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

const userByEmail = async (email: string) =>
  (await payload.find({ collection: "users", where: { email: { equals: email } } })).docs[0]!

const reader = () => ({ id: nextDiscordId(), email: uniqueEmail(), verified: true })

describe("comments", () => {
  it("posts as a member, and shows it to everyone without their address", async () => {
    const profile = reader()
    const cookie = await signIn(profile)

    const { comment } = await posted(article, cookie, "  First!\r\n\r\n\r\n\r\nSecond paragraph.  ")
    expect(comment).toMatchObject({
      body: "First!\n\nSecond paragraph.",
      parentId: null,
      depth: 0,
      author: { name: "Reader One", image: DEFAULT_AVATAR, badge: null },
    })

    const anonymous = await thread(article)
    expect(anonymous.viewer).toBeNull()
    expect(anonymous.providers).toEqual([{ id: "discord", label: "Discord" }])
    expect(anonymous.maxDepth).toBe(5)
    expect(anonymous.comments.map((c) => c.id)).toContain(comment.id)
    expect(JSON.stringify(anonymous)).not.toContain(profile.email)

    const own = await thread(article, cookie)
    expect(own.viewer).toEqual({
      name: "Reader One",
      image: DEFAULT_AVATAR,
      badge: null,
      locked: null,
      needsVerifiedEmail: false,
    })
    expect(own.providers).toEqual([])
  })

  it("badges staff, who comment through their Payload login", async () => {
    const editor = await createUser("editor")
    const login = await api("/users/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: editor.email, password: "test-password" }),
    })
    const cookie = login.headers
      .getSetCookie()
      .map((c) => c.split(";")[0])
      .join("; ")

    const { comment } = await posted(article, cookie, "From the desk")
    expect(comment.author?.badge).toBe("Staff")
  })

  it("nests replies, up to the depth the settings allow when they're posted", async () => {
    const a = await signIn(reader())
    const b = await signIn(reader())
    await setSettings({ maxDepth: 1 })

    const { comment: top } = await posted(article, a, "Top")
    const { comment: reply } = await posted(article, b, "Reply", top.id)
    expect(reply).toMatchObject({ parentId: top.id, depth: 1 })

    vi.useFakeTimers({ now: Date.now() + 60_000, toFake: ["Date"] })
    const tooDeep = await post(article, a, "Too deep", reply.id)
    expect(tooDeep.status).toBe(400)
    expect(((await tooDeep.json()) as { message: string }).message).toBe(
      "Replies are limited to 1 levels here.",
    )

    // Lowering the limit leaves what's there; it only stops new replies past it.
    await setSettings({ maxDepth: 0 })
    expect((await thread(article)).comments.map((c) => c.id)).toContain(reply.id)
    expect((await thread(article)).maxDepth).toBe(0)
  })

  it("keeps a removed comment's replies in place, under a placeholder", async () => {
    const a = await signIn(reader())
    const b = await signIn(reader())
    const { comment: top } = await posted(article, a, "Soon hidden")
    const { comment: reply } = await posted(article, b, "Still here", top.id)

    await payload.update({ collection: "comments", id: top.id, data: { status: "hidden" } })

    const comments = (await thread(article)).comments
    expect(comments.find((c) => c.id === top.id)).toMatchObject({
      removed: true,
      body: "",
      author: null,
    })
    expect(comments.find((c) => c.id === reply.id)).toMatchObject({ parentId: top.id })
  })

  it("won't reply to a comment on another article, or one that's gone", async () => {
    const cookie = await signIn(reader())
    const writer = await createUser("writer")
    const other = await createArticle({ authors: [writer.id] })
    const { comment } = await posted(other, cookie, "Elsewhere")

    vi.useFakeTimers({ now: Date.now() + 60_000, toFake: ["Date"] })
    expect((await post(article, cookie, "Cross", comment.id)).status).toBe(400)
    expect((await post(article, cookie, "Ghost", 99_999_999)).status).toBe(400)
  })

  it("holds a comment a check fails, shows it to its author only, and counts it", async () => {
    const profile = reader()
    const cookie = await signIn(profile)

    const result = await posted(
      article,
      cookie,
      "Look: https://a.test https://b.test https://c.test",
    )
    expect(result.held).toBe("More than 2 links")
    expect(result.comment.held).toBe(true)

    expect((await thread(article)).comments.map((c) => c.id)).not.toContain(result.comment.id)
    const own = (await thread(article, cookie)).comments.find((c) => c.id === result.comment.id)
    expect(own?.held).toBe(true)

    const author = await userByEmail(profile.email)
    const violations = await payload.find({
      collection: "comment-violations",
      where: { author: { equals: author.id } },
    })
    expect(violations.docs[0]).toMatchObject({ source: "check", reversed: false })

    // A moderator publishing it reverses the violation.
    await payload.update({
      collection: "comments",
      id: result.comment.id,
      data: { status: "published" },
    })
    const after = await payload.findByID({
      collection: "comment-violations",
      id: violations.docs[0]!.id,
    })
    expect(after.reversed).toBe(true)
  })

  it("holds a comment its author already posted", async () => {
    const cookie = await signIn(reader())
    await posted(article, cookie, "Same again")

    vi.useFakeTimers({ now: Date.now() + 60_000, toFake: ["Date"] })
    const { held } = await posted(article, cookie, "Same again")
    expect(held).toBe("Repeats an earlier comment")
  })

  it("locks an account with too many violations, until they're reversed", async () => {
    const profile = reader()
    const cookie = await signIn(profile)
    const author = await userByEmail(profile.email)
    await setSettings({ violationThreshold: 2 })

    const { comment } = await posted(article, cookie, "Rude")
    await payload.update({ collection: "comments", id: comment.id, data: { status: "hidden" } })
    await payload.create({
      collection: "comment-violations",
      data: { author: author.id, source: "moderator", reason: "Earlier" },
    })

    const locked = (await thread(article, cookie)).viewer?.locked
    expect(locked?.until).toEqual(expect.any(String))
    vi.useFakeTimers({ now: Date.now() + 60_000, toFake: ["Date"] })
    const refused = await post(article, cookie, "Let me in")
    expect(refused.status).toBe(403)

    await payload.update({ collection: "comments", id: comment.id, data: { status: "published" } })
    expect((await thread(article, cookie)).viewer?.locked).toBeNull()
  })

  it("stops a blocked account at once, with no end date", async () => {
    const profile = reader()
    const cookie = await signIn(profile)
    const author = await userByEmail(profile.email)

    await payload.create({
      collection: "comment-violations",
      data: { author: author.id, source: "block", reason: "Ban evasion" },
    })

    expect((await thread(article, cookie)).viewer?.locked).toEqual({ until: null })
    expect((await post(article, cookie, "Hello")).status).toBe(403)
  })

  it("lets anyone signed in comment until the verified-email switch is on", async () => {
    const profile = reader()
    const cookie = await signIn(profile)
    const author = await userByEmail(profile.email)
    // An address no provider vouched for (a future Destiny.gg-only member, say).
    const { pool } = payload.db as unknown as {
      pool: { query: (sql: string, values: unknown[]) => Promise<unknown> }
    }
    await pool.query("update users set email_verified = false where id = $1", [author.id])

    expect((await thread(article, cookie)).viewer?.needsVerifiedEmail).toBe(false)
    await posted(article, cookie, "Before the switch")

    await setSettings({ requireVerifiedEmail: true })
    expect((await thread(article, cookie)).viewer?.needsVerifiedEmail).toBe(true)
    vi.useFakeTimers({ now: Date.now() + 60_000, toFake: ["Date"] })
    expect((await post(article, cookie, "After the switch")).status).toBe(403)

    // A verified member still can.
    const verified = await signIn(reader())
    expect((await thread(article, verified)).viewer?.needsVerifiedEmail).toBe(false)
    expect((await post(article, verified, "Verified")).status).toBe(201)
  })

  it("asks someone who isn't signed in to sign in, and refuses other sites", async () => {
    expect((await post(article, "", "Hello")).status).toBe(401)

    const cookie = await signIn(reader())
    const response = await api(`/comments/thread/${article.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie, Origin: "https://evil.test" },
      body: JSON.stringify({ body: "Hello" }),
    })
    expect(response.status).toBe(403)
  })

  it("refuses an empty comment, and a second one straight after the first", async () => {
    const cookie = await signIn(reader())

    expect((await post(article, cookie, "   ")).status).toBe(400)
    expect((await post(article, cookie, "One")).status).toBe(201)
    expect((await post(article, cookie, "Two")).status).toBe(429)
  })

  it("takes comments only on published articles", async () => {
    const cookie = await signIn(reader())
    const writer = await createUser("writer")
    const draft = await createArticle({ authors: [writer.id], _status: "draft" })

    expect((await post(draft, cookie, "Early")).status).toBe(404)
    expect((await post({ id: 99_999_999 }, cookie, "Nowhere")).status).toBe(404)
  })

  it("empties a deleted account's comments, keeping replies to them", async () => {
    const a = reader()
    const aCookie = await signIn(a)
    const bCookie = await signIn(reader())
    const { comment: top } = await posted(article, aCookie, "Mine")
    const { comment: reply } = await posted(article, bCookie, "Yours", top.id)

    const deleted = await api("/account", { method: "DELETE", headers: { Cookie: aCookie } })
    expect(deleted.status).toBe(200)

    const stored = await payload.findByID({ collection: "comments", id: top.id })
    expect(stored).toMatchObject({ status: "deleted", body: "" })
    expect(stored.author ?? null).toBeNull()
    const comments = (await thread(article)).comments
    expect(comments.find((c) => c.id === top.id)?.removed).toBe(true)
    expect(comments.find((c) => c.id === reply.id)).toBeDefined()
  })

  it("deletes a comment's replies with it, and an article's comments with the article", async () => {
    const cookie = await signIn(reader())
    const other = await signIn(reader())
    const writer = await createUser("writer")
    const own = await createArticle({ authors: [writer.id] })
    const { comment: top } = await posted(own, cookie, "Top")
    const { comment: reply } = await posted(own, other, "Reply", top.id)

    await payload.delete({ collection: "comments", id: top.id })
    await expect(
      payload.findByID({ collection: "comments", id: reply.id, disableErrors: true }),
    ).resolves.toBeNull()

    vi.useFakeTimers({ now: Date.now() + 60_000, toFake: ["Date"] })
    await posted(own, cookie, "Also soon gone")
    await payload.delete({
      collection: "articles",
      id: own.id,
      context: { disableRevalidate: true },
    })
    expect(
      (await payload.count({ collection: "comments", where: { target: { equals: own.id } } }))
        .totalDocs,
    ).toBe(0)
  })

  it("lets editors moderate, admins change the settings, and nobody create a comment", async () => {
    const writer = await createUser("writer")
    const editor = await createUser("editor")
    const admin = await createUser("admin")

    await expect(
      payload.find({ collection: "comments", user: writer, overrideAccess: false }),
    ).rejects.toThrow()
    await expect(
      payload.find({ collection: "comment-violations", user: editor, overrideAccess: false }),
    ).resolves.toBeDefined()
    await expect(
      payload.create({
        collection: "comments",
        user: editor,
        overrideAccess: false,
        data: { body: "x", target: article.id, depth: 0, status: "published" },
      }),
    ).rejects.toThrow()
    await expect(
      payload.updateGlobal({
        slug: "comment-settings",
        user: editor,
        overrideAccess: false,
        data: { maxDepth: 9 },
      }),
    ).rejects.toThrow()
    await expect(
      payload.updateGlobal({
        slug: "comment-settings",
        user: admin,
        overrideAccess: false,
        data: { maxDepth: 4 },
      }),
    ).resolves.toMatchObject({ maxDepth: 4 })
  })

  it("is switched off with the experiment, sign-ups included", async () => {
    const cookie = await signIn(reader())

    await setExperiment(false)

    expect((await api(`/comments/thread/${article.id}`)).status).toBe(404)
    expect((await post(article, cookie, "Hello")).status).toBe(404)

    const profile = reader()
    stubDiscord(profile)
    const start = await api("/auth/sign-in/social", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider: "discord", requestSignUp: true, callbackURL: "/x" }),
    })
    const { url } = (await start.json()) as { url: string }
    const state = new URL(url).searchParams.get("state")
    const callback = await api(`/auth/callback/discord?code=test-code&state=${state}`, {
      headers: { Cookie: cookiesFrom(start) },
    })
    expect(callback.headers.get("location")).toContain("error=")
  })
})
