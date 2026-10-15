import config from "@payload-config"
import { handleEndpoints, type Payload } from "payload"
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"

import type { MyAchievements } from "@/plugins/achievements"
import type { CommentThread, PublicComment } from "@/plugins/comments"
import { readerAchievements } from "@/plugins/readerAchievements"
import { getSiteURL } from "@/utilities/getURL"
import type { Article, Award, User } from "@/payload-types"
import { createArticle } from "./helpers/content"
import { createUser, getPayload } from "./helpers/testUsers"

// Readers sign up with Discord (stubbed), earn Early member and Verified, and comment; editors
// define achievements, and a moderator gives and revokes them, as the local API with their user.

vi.mock("next/headers", () => ({
  cookies: () => Promise.reject(new Error("no request scope")),
}))

let payload: Payload
const site = getSiteURL()

function stubDiscord(profile: { id: string; email: string; verified: boolean }) {
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

let discordId = 7000
/** Signs a new reader up with Discord, and returns their cookie and account. */
async function signUp(verified = true): Promise<{ cookie: string; user: User }> {
  const email = `reader-${crypto.randomUUID().slice(0, 8)}@example.com`
  stubDiscord({ id: String(++discordId), email, verified })
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
  return { cookie: cookiesFrom(callback), user }
}

let article: Article
let editor: User
let writer: User
/** A member who signed up before the site had achievements, after the staff. */
let olderMember: User
/** The seeded achievements' IDs. */
let early: number
let verified: number

const setSwitches = (achievements: boolean) =>
  payload.updateGlobal({
    slug: "plugins",
    data: { switches: { sso: true, comments: true, achievements } },
    context: { disableRevalidate: true },
  })

const mine = async (cookie: string) => {
  const response = await api("/achievements/mine", { headers: { Cookie: cookie } })
  return { status: response.status, body: (await response.json()) as MyAchievements }
}

/** Posts a comment as the reader (past the cooldown) and returns the badge it shows. */
async function badgeOnComment(cookie: string): Promise<string | null> {
  vi.setSystemTime(Date.now() + 60_000)
  const response = await api(`/comments/thread/${article.id}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({ body: `Hello ${crypto.randomUUID()}` }),
  })
  expect(response.status, await response.clone().text()).toBe(201)
  const { comment } = (await response.json()) as { comment: PublicComment }
  const thread = (await (await api(`/comments/thread/${article.id}`)).json()) as CommentThread
  expect(thread.comments.find((c) => c.id === comment.id)?.author?.badge).toBe(
    comment.author?.badge,
  )
  return comment.author?.badge ?? null
}

/** A validation error whose message for a field matches `message`. */
const invalid = (message: RegExp) => ({
  data: { errors: [expect.objectContaining({ message: expect.stringMatching(message) })] },
})

const rowsOf = async (user: User) =>
  (
    await payload.find({
      collection: "awards",
      where: { user: { equals: user.id } },
      depth: 0,
      overrideAccess: true,
    })
  ).docs as Award[]
const achievementsOf = async (user: User) => (await rowsOf(user)).map((row) => row.achievement)

const idOf = async (name: string) =>
  (
    await payload.find({
      collection: "achievements",
      where: { name: { equals: name } },
      overrideAccess: true,
    })
  ).docs[0]!.id

beforeAll(async () => {
  payload = await getPayload()
  writer = await createUser("writer")
  editor = await createUser("editor")
  article = await createArticle({ authors: [writer.id] })
  olderMember = await createUser("member")
  await readerAchievements.seed(payload)
  early = await idOf("Early member")
  verified = await idOf("Verified")
})

beforeEach(async () => {
  vi.stubEnv("DISCORD_CLIENT_ID", "discord-client")
  vi.stubEnv("DISCORD_CLIENT_SECRET", "discord-secret")
  vi.useFakeTimers({ toFake: ["Date"] })
  await setSwitches(true)
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe("achievements", () => {
  it("gives Early member to members who signed up before the site had it", async () => {
    expect(await achievementsOf(olderMember)).toContain(early)
  })

  it("fills it on the next deploy when its first fill missed members, and only then", async () => {
    const deleteAward = () =>
      payload.delete({
        collection: "awards",
        where: { user: { equals: olderMember.id } },
        overrideAccess: true,
      })
    // As on a site whose Early member was made before fills were recorded.
    await deleteAward()
    await payload.kv.delete(`seeded:awards:filled-${early}`)

    await readerAchievements.seed(payload)
    expect(await achievementsOf(olderMember)).toEqual([early])

    // An award an admin deletes stays deleted.
    await deleteAward()
    await readerAchievements.seed(payload)
    expect(await achievementsOf(olderMember)).toEqual([])
  })

  it("awards a new member Early member, and shows it on their comments and account", async () => {
    const { cookie, user } = await signUp()

    expect(await achievementsOf(user)).toEqual([early])
    expect(await badgeOnComment(cookie)).toBe("Early member")
    const { status, body } = await mine(cookie)
    expect(status).toBe(200)
    expect(body.achievements.map((a) => a.label)).toEqual(["Early member", "Verified"])
  })

  it("awards staff Early member too, those already there and those made later", async () => {
    expect(await achievementsOf(writer)).toEqual([early])
    const staff = await createUser(["editor"])
    expect(await achievementsOf(staff)).toEqual([early])
  })

  it("lets a moderator revoke one, with a reason, and give it back", async () => {
    const { cookie, user } = await signUp()
    const [earlyMember] = await rowsOf(user)

    await expect(
      payload.update({
        collection: "awards",
        id: earlyMember!.id,
        data: { revoked: true },
        user: editor,
        overrideAccess: false,
      }),
    ).rejects.toThrow()

    const revoked = await payload.update({
      collection: "awards",
      id: earlyMember!.id,
      data: { revoked: true, revokedReason: "Ban evasion" },
      user: editor,
      overrideAccess: false,
    })
    expect(revoked).toMatchObject({ revokedReason: "Ban evasion", revokedAt: expect.any(String) })
    expect(typeof revoked.revokedBy === "object" ? revoked.revokedBy?.id : revoked.revokedBy).toBe(
      editor.id,
    )
    expect(await badgeOnComment(cookie)).toBe("Verified")

    // Verified has no row: revoking it is a new one.
    await payload.create({
      collection: "awards",
      data: { user: user.id, achievement: verified, revoked: true, revokedReason: "Spam" },
      user: editor,
      overrideAccess: false,
    })
    expect(await badgeOnComment(cookie)).toBeNull()
    expect((await mine(cookie)).body.achievements).toEqual([])

    await payload.update({
      collection: "awards",
      id: earlyMember!.id,
      data: { revoked: false },
      user: editor,
      overrideAccess: false,
    })
    expect(await badgeOnComment(cookie)).toBe("Early member")
  })

  it("lets only moderators make revocations, and nobody hand an achievement out", async () => {
    const { user } = await signUp()

    await expect(
      payload.create({
        collection: "awards",
        data: { user: user.id, achievement: verified, revoked: true, revokedReason: "No" },
        user: writer,
        overrideAccess: false,
      }),
    ).rejects.toThrow()
    await expect(
      payload.create({
        collection: "awards",
        data: { user: writer.id, achievement: early, earnedAt: new Date().toISOString() },
        user: editor,
        overrideAccess: false,
      }),
    ).rejects.toMatchObject(invalid(/earned, not given/))
    await expect(
      payload.create({
        collection: "awards",
        data: { user: user.id, achievement: early, revoked: true, revokedReason: "x" },
        user: editor,
        overrideAccess: false,
      }),
    ).rejects.toMatchObject(invalid(/already has a row/))
  })

  it("keeps rows from members and anyone signed out", async () => {
    const { cookie } = await signUp()

    const asMember = await api("/achievements", { headers: { Cookie: cookie } })
    expect(asMember.status).toBe(403)
    expect((await api("/achievements")).status).toBe(403)
  })

  it("shows nothing while switched off, but still awards Early member", async () => {
    await setSwitches(false)
    const { cookie, user } = await signUp()

    expect(await achievementsOf(user)).toEqual([early])
    expect(await badgeOnComment(cookie)).toBeNull()
    expect((await mine(cookie)).status).toBe(404)
  })

  it("keeps a deleted member's place, so nobody later moves up", async () => {
    const { user } = await signUp()
    const before = await payload.count({
      collection: "awards",
      where: { achievement: { equals: early } },
      overrideAccess: true,
    })

    await payload.delete({ collection: "users", id: user.id, overrideAccess: true })

    const after = await payload.count({
      collection: "awards",
      where: { achievement: { equals: early } },
      overrideAccess: true,
    })
    expect(after.totalDocs).toBe(before.totalDocs)
  })

  it("lets editors define an achievement a moderator gives by hand, listed on the user's record", async () => {
    const { cookie, user } = await signUp()
    const helper = await payload.create({
      collection: "achievements",
      data: { name: "Helper", description: "Helped out.", rule: "manual", badge: true },
      user: editor,
      overrideAccess: false,
    })
    await expect(
      payload.update({
        collection: "achievements",
        id: helper.id,
        data: { name: "Helper" },
        user: writer,
        overrideAccess: false,
      }),
    ).rejects.toThrow()

    const given = await payload.create({
      collection: "awards",
      data: { user: user.id, achievement: helper.id },
      user: editor,
      overrideAccess: false,
    })
    expect(given.earnedAt).toEqual(expect.any(String))
    const labels = (await mine(cookie)).body.achievements.map((a) => a.label)
    expect(labels).toEqual(["Early member", "Verified", "Helper"])

    const record = await payload.findByID({
      collection: "users",
      id: user.id,
      depth: 0,
      user: editor,
      overrideAccess: false,
    })
    expect(record.awards?.docs?.length).toBe(2)

    // Deleting the achievement deletes its awards.
    await payload.delete({ collection: "achievements", id: helper.id, overrideAccess: true })
    expect(await achievementsOf(user)).toEqual([early])
  })

  it("awards a new first-members achievement to existing accounts, and more when its limit rises", async () => {
    const { user } = await signUp()
    const accounts = await payload.count({ collection: "users", overrideAccess: true })
    const founding = await payload.create({
      collection: "achievements",
      data: { name: "Founding reader", rule: "firstMembers", limit: 1, badge: false },
      user: editor,
      overrideAccess: false,
    })
    const holders = () =>
      payload.count({
        collection: "awards",
        where: { achievement: { equals: founding.id } },
        overrideAccess: true,
      })
    expect((await holders()).totalDocs).toBe(1)

    await payload.update({
      collection: "achievements",
      id: founding.id,
      data: { limit: accounts.totalDocs + 5 },
      user: editor,
      overrideAccess: false,
    })
    expect((await holders()).totalDocs).toBe(accounts.totalDocs)
    expect(await achievementsOf(user)).toContain(founding.id)
  })

  it("creates the starter achievements once per site", async () => {
    expect(await readerAchievements.seed(payload)).toEqual([])
  })
})
