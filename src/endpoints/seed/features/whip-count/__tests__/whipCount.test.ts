import type { Media, User } from "@/payload-types"
import type { Payload } from "payload"
import { describe, expect, it, vi } from "vitest"

import { parseWhipCount } from "@/interactives/whip-count/model"

import { createSenateLeaderWhipCount, createWhipCountArticle, WHIP_COUNT_SLUG } from ".."

interface Created {
  collection: string
  data: Record<string, unknown>
  context?: unknown
}

/** Payload's unique-slug failure, as the Local API throws it. */
const takenSlug = Object.assign(new Error("The following field is invalid: slug"), {
  data: { errors: [{ message: "Value must be unique", path: "slug" }] },
})

function fakePayload(fail?: (args: Created) => Error | undefined) {
  const created: Created[] = []
  const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() }
  const create = vi.fn(async (args: Created) => {
    const error = fail?.(args)
    if (error) throw error
    created.push(args)
    return { id: 40 + created.length, ...args.data }
  })
  return { payload: { create, logger } as unknown as Payload, created, logger }
}

const writer = { id: 1, roles: ["writer"] } as User
const media = [{ id: 9 } as Media]

describe("createSenateLeaderWhipCount", () => {
  it("creates a published whip count interactive, then its snapshot with the count", async () => {
    const { payload, created } = fakePayload()
    await createSenateLeaderWhipCount(payload, { disableRevalidate: true })
    expect(created.map((args) => args.collection)).toEqual([
      "interactives",
      "interactive-snapshots",
    ])
    expect(created[0]).toMatchObject({
      context: { disableRevalidate: true },
      data: {
        slug: WHIP_COUNT_SLUG,
        profile: "whip-count",
        feed: { autoPublish: true },
        _status: "published",
      },
    })
    const snapshot = created[1]!
    expect(snapshot).toMatchObject({
      context: { disableRevalidate: true },
      data: {
        interactive: 41,
        sourceRef: "seed",
        sourceVersion: "2026-11-13",
        _status: "published",
      },
    })
    expect(parseWhipCount(snapshot.data.data).success).toBe(true)
  })

  it("leaves a count that is already there alone, and says so", async () => {
    const { payload, logger } = fakePayload(() => takenSlug)
    await expect(createSenateLeaderWhipCount(payload)).resolves.toBeUndefined()
    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining("already there"))
    // The same failure as `pnpm showcase` reports it.
    const rest = fakePayload(
      () => new Error("Creating interactives failed (400): The following field is invalid: slug"),
    )
    await expect(createSenateLeaderWhipCount(rest.payload)).resolves.toBeUndefined()
    // Its snapshot is left alone too.
    expect(rest.created).toEqual([])
  })

  it("throws any other failure, such as an account that may not create one", async () => {
    const { payload } = fakePayload(() => new Error("You are not allowed to perform this action."))
    await expect(createSenateLeaderWhipCount(payload)).rejects.toThrow("not allowed")
  })
})

describe("createWhipCountArticle", () => {
  it("creates the count, then an article that links to it", async () => {
    const { payload, created } = fakePayload()
    const id = await createWhipCountArticle(payload, [writer], media, [4])
    expect(created.map((args) => args.collection)).toEqual([
      "interactives",
      "interactive-snapshots",
      "articles",
    ])
    expect(id).toBe(43)
    const article = created[2]!.data
    expect(article).toMatchObject({
      slug: "whip-counts-draft-your-own-leadership-vote",
      authors: [1],
      topics: [4],
      heroImage: 9,
    })
    expect(JSON.stringify(article.content)).toContain(`"/interactives/${WHIP_COUNT_SLUG}"`)
  })

  it("still creates the article when the count is already there", async () => {
    const { payload, created } = fakePayload((args) =>
      args.collection === "interactives" ? takenSlug : undefined,
    )
    await createWhipCountArticle(payload, [writer], media)
    expect(created.map((args) => args.collection)).toEqual(["articles"])
  })

  it("creates no article that would link to a count it couldn't create", async () => {
    const { payload, created } = fakePayload((args) =>
      args.collection === "interactives" ? new Error("Forbidden") : undefined,
    )
    await expect(createWhipCountArticle(payload, [writer], media)).rejects.toThrow("Forbidden")
    expect(created).toEqual([])
  })

  it("needs a writer and a picture", async () => {
    const { payload } = fakePayload()
    await expect(createWhipCountArticle(payload, [], media)).rejects.toThrow()
    await expect(createWhipCountArticle(payload, [writer], [])).rejects.toThrow(
      "requires a media document",
    )
  })
})
