import type { Payload } from "payload"
import { describe, expect, it, vi } from "vitest"

import type { User } from "@/payload-types"

import { canSeeArticleStats, showStatsTab, STATS_FLAG, statsFlagField } from "../access"

const user = (id: number, ...roles: string[]) => ({ id, roles }) as unknown as User

const payloadWith = (narration: { narrator?: unknown } | null) =>
  ({ findByID: vi.fn(async () => narration) }) as unknown as Payload & {
    findByID: ReturnType<typeof vi.fn>
  }

const article = { authors: [2, user(3, "writer")], narration: 11 }

describe("canSeeArticleStats", () => {
  it("lets nobody signed out see them", async () => {
    expect(await canSeeArticleStats(payloadWith(null), null, article)).toBe(false)
  })

  it.each(["editor", "chief-editor", "admin"])("lets an %s see every article's", async (role) => {
    const payload = payloadWith(null)
    expect(await canSeeArticleStats(payload, user(9, role), { authors: [] })).toBe(true)
    expect(payload.findByID).not.toHaveBeenCalled()
  })

  it("lets a writer see the articles they're credited on, by id or populated", async () => {
    const payload = payloadWith(null)
    expect(await canSeeArticleStats(payload, user(2, "writer"), article)).toBe(true)
    expect(await canSeeArticleStats(payload, user(3, "writer"), article)).toBe(true)
    expect(await canSeeArticleStats(payload, user(4, "writer"), article)).toBe(false)
  })

  it("doesn't let a writer see an article with no authors", async () => {
    expect(await canSeeArticleStats(payloadWith(null), user(2, "writer"), {})).toBe(false)
  })

  it("lets a narrator see the articles whose audio names them", async () => {
    const payload = payloadWith({ narrator: { id: 5 } })
    expect(await canSeeArticleStats(payload, user(5, "narrator"), article)).toBe(true)
    expect(payload.findByID).toHaveBeenCalledWith(
      expect.objectContaining({ collection: "media", id: 11, select: { narrator: true } }),
    )
  })

  it("doesn't let a narrator see another narrator's article, or one with no audio", async () => {
    const narrator = user(5, "narrator")
    expect(await canSeeArticleStats(payloadWith({ narrator: 6 }), narrator, article)).toBe(false)
    expect(await canSeeArticleStats(payloadWith(null), narrator, article)).toBe(false)

    const noAudio = payloadWith(null)
    expect(await canSeeArticleStats(noAudio, narrator, { authors: [] })).toBe(false)
    expect(noAudio.findByID).not.toHaveBeenCalled()
  })

  it("doesn't let a member with no staff role see any", async () => {
    expect(await canSeeArticleStats(payloadWith(null), user(2, "member"), article)).toBe(false)
  })
})

describe("statsFlagField", () => {
  const flag = statsFlagField as {
    name: string
    virtual: boolean
    hooks: { afterRead: ((args: unknown) => Promise<unknown>)[] }
  }
  const run = (args: Record<string, unknown>) => flag.hooks.afterRead[0]!(args)
  const req = (u: User | null) => ({ user: u, payload: payloadWith(null) })

  it("is a virtual field named for the flag", () => {
    expect(flag.name).toBe(STATS_FLAG)
    expect(flag.virtual).toBe(true)
  })

  it("works the flag out for one article", async () => {
    expect(await run({ data: article, req: req(user(2, "writer")), findMany: false })).toBe(true)
    expect(await run({ data: article, req: req(user(4, "writer")), findMany: false })).toBe(false)
  })

  it("skips lists, signed-out reads and missing data", async () => {
    expect(
      await run({ data: article, req: req(user(1, "editor")), findMany: true }),
    ).toBeUndefined()
    expect(await run({ data: article, req: req(null), findMany: false })).toBeUndefined()
    expect(await run({ data: undefined, req: req(user(1, "editor")) })).toBeUndefined()
  })
})

describe("showStatsTab", () => {
  const show = (data: Record<string, unknown> | undefined) =>
    (showStatsTab as (data: unknown) => boolean)(data)

  it("shows the tab on a saved article the user may see", () => {
    expect(show({ id: 7, [STATS_FLAG]: true })).toBe(true)
  })

  it("hides it on a new article, or when the flag isn't true", () => {
    expect(show({ [STATS_FLAG]: true })).toBe(false)
    expect(show({ id: 7, [STATS_FLAG]: false })).toBe(false)
    expect(show({ id: 7 })).toBe(false)
    expect(show(undefined)).toBe(false)
  })
})
