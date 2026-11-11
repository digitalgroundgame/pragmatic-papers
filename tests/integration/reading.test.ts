import config from "@payload-config"
import { handleEndpoints, type Payload } from "payload"
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"

import type { MyReading } from "@/plugins/achievements"
import { getSiteURL } from "@/utilities/getURL"
import type { Article, User } from "@/payload-types"
import { createArticle, createVolume } from "./helpers/content"
import { createUser, getPayload } from "./helpers/testUsers"

// A reader signs up with Discord (stubbed), reads articles and visits, and sees the totals on
// their account; deleting the account, or an article, deletes what was kept.

vi.mock("next/headers", () => ({
  cookies: () => Promise.reject(new Error("no request scope")),
}))

let payload: Payload
const site = getSiteURL()

function stubDiscord(profile: { id: string; email: string }) {
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
          global_name: "Reader",
          ...profile,
          verified: true,
          username: "reader",
          discriminator: "0",
          avatar: null,
        }),
      )
    }
    return Promise.reject(new Error(`unexpected request to ${url}`))
  })
}

const cookiesFrom = (response: Response): string =>
  response.headers
    .getSetCookie()
    .map((cookie) => cookie.split(";")[0])
    .filter((pair) => !pair?.endsWith("="))
    .join("; ")

const api = (path: string, init: RequestInit = {}) =>
  handleEndpoints({
    config,
    request: new Request(`${site}/api${path}`, {
      ...init,
      headers: { Origin: site, ...init.headers },
    }),
  })

let discordId = 9000
/** Signs a new reader up with Discord, and returns the sign-in's cookies and account. */
async function signUp(): Promise<{ cookie: string; setCookies: string[]; user: User }> {
  const email = `reading-${crypto.randomUUID().slice(0, 8)}@example.com`
  stubDiscord({ id: String(++discordId), email })
  const start = await api("/auth/sign-in/social", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ provider: "discord", requestSignUp: true, callbackURL: "/account" }),
  })
  const { url } = (await start.json()) as { url: string }
  const state = new URL(url).searchParams.get("state")
  const callback = await api(`/auth/callback/discord?code=test-code&state=${state}`, {
    headers: { Cookie: cookiesFrom(start) },
  })
  expect(callback.status).toBe(302)
  vi.unstubAllGlobals()
  const user = (await payload.find({ collection: "users", where: { email: { equals: email } } }))
    .docs[0]!
  return { cookie: cookiesFrom(callback), setCookies: callback.headers.getSetCookie(), user }
}

const today = () => new Date().toISOString().slice(0, 10)

const report = (cookie: string, body: Record<string, unknown>) =>
  api("/reading", {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({ day: today(), ...body }),
  })

const mine = async (cookie: string) => {
  const response = await api("/reading/mine", { headers: { Cookie: cookie } })
  return { status: response.status, body: (await response.json()) as MyReading }
}

const readsOf = async (user: User) =>
  (
    await payload.find({
      collection: "articles-read",
      where: { user: { equals: user.id } },
      depth: 0,
      overrideAccess: true,
    })
  ).docs.map((row) => row.article)

const setAchievements = (achievements: boolean) =>
  payload.updateGlobal({
    slug: "plugins",
    data: { switches: { sso: true, comments: true, achievements } },
    context: { disableRevalidate: true },
  })

let first: Article
let second: Article
let draft: Article

beforeAll(async () => {
  payload = await getPayload()
  const writer = await createUser("writer")
  first = await createArticle({ authors: [writer.id] })
  second = await createArticle({ authors: [writer.id] })
  draft = await createArticle({ authors: [writer.id], _status: "draft" })
  await createVolume({ articles: [first.id, second.id] })
})

beforeEach(async () => {
  vi.stubEnv("DISCORD_CLIENT_ID", "discord-client")
  vi.stubEnv("DISCORD_CLIENT_SECRET", "discord-secret")
  await setAchievements(true)
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe("reading, for achievements", () => {
  it("tells the page someone is signed in, with a cookie it can read", async () => {
    const { setCookies } = await signUp()
    const mark = setCookies.find((cookie) => cookie.startsWith("pp-signed-in=1"))
    expect(mark).toBeDefined()
    expect(mark).not.toMatch(/HttpOnly/i)
  })

  it("keeps a reader's visits and reads, and adds them up on their account", async () => {
    const { cookie, user } = await signUp()

    expect((await report(cookie, {})).status).toBe(204)
    expect((await report(cookie, { article: first.id })).status).toBe(204)
    expect((await report(cookie, { article: first.id })).status).toBe(204)
    expect(await readsOf(user)).toEqual([first.id])

    const stored = await payload.findByID({ collection: "users", id: user.id, depth: 0 })
    expect(stored.reading).toMatchObject({
      daysVisited: 1,
      lastVisitOn: today(),
      currentStreak: 1,
      longestStreak: 1,
    })

    expect((await mine(cookie)).body).toMatchObject({ articlesRead: 1, volumesRead: 0 })
    await report(cookie, { article: second.id })
    expect((await mine(cookie)).body).toEqual({
      articlesRead: 2,
      volumesRead: 1,
      daysVisited: 1,
      currentStreak: 1,
      longestStreak: 1,
    })
  })

  it("leaves drafts out, and turns away readers who aren't signed in", async () => {
    const { cookie, user } = await signUp()
    expect((await report(cookie, { article: draft.id })).status).toBe(204)
    expect(await readsOf(user)).toEqual([])
    expect((await report("", { article: first.id })).status).toBe(401)
  })

  it("keeps nothing while achievements are switched off", async () => {
    const { cookie, user } = await signUp()
    await setAchievements(false)
    expect((await report(cookie, { article: first.id })).status).toBe(404)
    expect((await mine(cookie)).status).toBe(404)
    expect(await readsOf(user)).toEqual([])
  })

  it("deletes the history with the account, and an article's reads with the article", async () => {
    const reader = await signUp()
    const other = await signUp()
    const gone = await createArticle({ authors: [(await createUser("writer")).id] })
    for (const { cookie } of [reader, other]) {
      await report(cookie, { article: first.id })
      await report(cookie, { article: gone.id })
    }

    await payload.delete({
      collection: "articles",
      id: gone.id,
      overrideAccess: true,
      context: { disableRevalidate: true },
    })
    expect(await readsOf(other.user)).toEqual([first.id])

    await payload.delete({ collection: "users", id: reader.user.id, overrideAccess: true })
    const left = await payload.find({
      collection: "articles-read",
      where: { user: { equals: reader.user.id } },
      overrideAccess: true,
    })
    expect(left.totalDocs).toBe(0)
  })
})
