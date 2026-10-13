import config from "@payload-config"
import { handleEndpoints, type Payload } from "payload"
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"

import { READER_COOKIE_NAME, type CommentThread, type PublicComment } from "@/plugins/comments"
import { SSO_COOKIE_NAME } from "@/plugins/sso"
import { getSiteURL } from "@/utilities/getURL"
import type { Article } from "@/payload-types"
import { createArticle } from "./helpers/content"
import { createUser, getPayload } from "./helpers/testUsers"

// A reader signs in with Discord (stubbed: the token exchange and the profile are answered
// here), then reads and posts comments through the endpoints, against the real database.

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

/** Signs a reader in with Discord as `profile`, and returns their cookie. */
async function signIn(profile: DiscordProfile): Promise<string> {
  stubDiscord(profile)
  const start = await api("/reader-auth/sign-in/social", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ provider: "discord", callbackURL: "/articles/x#comments" }),
  })
  expect(start.status).toBe(200)
  const { url } = (await start.json()) as { url: string }
  const state = new URL(url).searchParams.get("state")
  const callback = await api(`/reader-auth/callback/discord?code=test-code&state=${state}`, {
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

const post = (article: Article | { id: number }, cookie: string, body: unknown) =>
  api(`/comments/thread/${article.id}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({ body }),
  })

const setExperiment = (comments: boolean) =>
  payload.updateGlobal({
    slug: "site-settings",
    data: { experiments: { comments } },
    context: { disableRevalidate: true },
  })

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
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe("comments", () => {
  it("creates a reader on their first sign-in, apart from staff users", async () => {
    const email = uniqueEmail()

    const cookie = await signIn({ id: nextDiscordId(), email, verified: true })

    expect(cookie).toContain(`${READER_COOKIE_NAME}=`)
    expect(cookie).not.toContain(SSO_COOKIE_NAME)
    const readers = await payload.find({
      collection: "readers",
      where: { email: { equals: email } },
    })
    expect(readers.docs[0]).toMatchObject({ name: "Reader One", banned: false })
    const users = await payload.find({ collection: "users", where: { email: { equals: email } } })
    expect(users.totalDocs).toBe(0)

    // A reader's session is no way into the admin.
    const me = await api("/users/me", { headers: { Cookie: cookie } })
    expect(((await me.json()) as { user: unknown }).user).toBeNull()
  })

  it("posts a comment, and shows it to everyone without the reader's address", async () => {
    const email = uniqueEmail()
    const cookie = await signIn({ id: nextDiscordId(), email, verified: true })

    const response = await post(article, cookie, "  First!\r\n\r\n\r\n\r\nSecond paragraph.  ")

    expect(response.status).toBe(201)
    const { comment } = (await response.json()) as { comment: PublicComment }
    expect(comment).toMatchObject({
      body: "First!\n\nSecond paragraph.",
      author: { name: "Reader One", image: DEFAULT_AVATAR },
    })

    const anonymous = await thread(article)
    expect(anonymous.viewer).toBeNull()
    expect(anonymous.providers).toEqual(["discord"])
    expect(anonymous.comments.map((c) => c.id)).toContain(comment.id)
    expect(JSON.stringify(anonymous)).not.toContain(email)

    const own = await thread(article, cookie)
    expect(own.viewer).toEqual({ name: "Reader One", image: DEFAULT_AVATAR, banned: false })
  })

  it("asks a reader who isn't signed in to sign in", async () => {
    const response = await post(article, "", "Hello")
    expect(response.status).toBe(401)
  })

  it("refuses a post from another site", async () => {
    const cookie = await signIn({ id: nextDiscordId(), email: uniqueEmail(), verified: true })

    const response = await api(`/comments/thread/${article.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie, Origin: "https://evil.test" },
      body: JSON.stringify({ body: "Hello" }),
    })

    expect(response.status).toBe(403)
  })

  it("refuses an empty comment, and a second one straight after the first", async () => {
    const cookie = await signIn({ id: nextDiscordId(), email: uniqueEmail(), verified: true })

    expect((await post(article, cookie, "   ")).status).toBe(400)
    expect((await post(article, cookie, "One")).status).toBe(201)
    expect((await post(article, cookie, "Two")).status).toBe(429)
  })

  it("takes comments only on published articles", async () => {
    const cookie = await signIn({ id: nextDiscordId(), email: uniqueEmail(), verified: true })
    const writer = await createUser("writer")
    const draft = await createArticle({ authors: [writer.id], _status: "draft" })

    expect((await post(draft, cookie, "Early")).status).toBe(404)
    expect((await post({ id: 99_999_999 }, cookie, "Nowhere")).status).toBe(404)
  })

  it("leaves hidden comments off the thread, and stops a banned reader posting", async () => {
    const email = uniqueEmail()
    const cookie = await signIn({ id: nextDiscordId(), email, verified: true })
    const { comment } = (await (await post(article, cookie, "Spam")).json()) as {
      comment: PublicComment
    }

    await payload.update({ collection: "comments", id: comment.id, data: { status: "hidden" } })
    expect((await thread(article)).comments.map((c) => c.id)).not.toContain(comment.id)

    await payload.update({
      collection: "readers",
      where: { email: { equals: email } },
      data: { banned: true },
    })
    expect((await thread(article, cookie)).viewer?.banned).toBe(true)
    expect((await post(article, cookie, "More spam")).status).toBe(403)
  })

  it("deletes a reader's comments with the reader, and an article's with the article", async () => {
    const email = uniqueEmail()
    const cookie = await signIn({ id: nextDiscordId(), email, verified: true })
    const writer = await createUser("writer")
    const own = await createArticle({ authors: [writer.id] })
    await post(own, cookie, "Soon gone")

    await payload.delete({ collection: "readers", where: { email: { equals: email } } })
    expect(
      (await payload.count({ collection: "comments", where: { target: { equals: own.id } } }))
        .totalDocs,
    ).toBe(0)

    const second = await signIn({ id: nextDiscordId(), email: uniqueEmail(), verified: true })
    await post(own, second, "Also soon gone")
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

  it("lets editors moderate, not writers, and nobody create a comment in the admin", async () => {
    const writer = await createUser("writer")
    const editor = await createUser("editor")

    await expect(
      payload.find({ collection: "comments", user: writer, overrideAccess: false }),
    ).rejects.toThrow()
    await expect(
      payload.find({ collection: "readers", user: editor, overrideAccess: false }),
    ).resolves.toBeDefined()
    await expect(
      payload.create({
        collection: "comments",
        user: editor,
        overrideAccess: false,
        data: { body: "x", target: article.id, reader: 1, status: "published" },
      }),
    ).rejects.toThrow()
  })

  it("is switched off with the experiment", async () => {
    const cookie = await signIn({ id: nextDiscordId(), email: uniqueEmail(), verified: true })

    await setExperiment(false)

    expect((await api(`/comments/thread/${article.id}`)).status).toBe(404)
    expect((await post(article, cookie, "Hello")).status).toBe(404)
    const start = await api("/reader-auth/sign-in/social", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider: "discord" }),
    })
    expect(start.status).toBe(404)
  })

  it("keeps readers' sign-in to providers", async () => {
    for (const path of ["/sign-up/email", "/sign-in/email", "/update-user", "/delete-user"]) {
      const response = await api(`/reader-auth${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "a@example.com", password: "password1234", name: "A" }),
      })
      expect(response.status, path).toBe(404)
    }
  })
})
