import { describe, expect, it, beforeAll } from "vitest"
import type { Payload } from "payload"
import type { Volume } from "@/payload-types"
import { getPayload, createUser } from "../helpers/testUsers"

describe("volumes authenticatedOrPublished access", () => {
  let payload: Payload

  beforeAll(async () => {
    payload = await getPayload()
  })

  it("allows authenticated user to read a draft volume", async () => {
    const member = await createUser("member")

    const draft = await payload.create({
      collection: "volumes",
      overrideAccess: true,
      context: { disableRevalidate: true },
      data: {
        title: "Draft Volume AoP - volumes",
        description: "Draft volume description",
        _status: "draft",
      } as unknown as Volume,
    })

    const result = await payload.findByID({
      collection: "volumes",
      id: draft.id,
      overrideAccess: false,
      user: member,
    })

    expect(result.id).toBe(draft.id)
  })

  it("allows authenticated user to read a published volume", async () => {
    const member = await createUser("member")

    const published = await payload.create({
      collection: "volumes",
      overrideAccess: true,
      context: { disableRevalidate: true },
      data: {
        title: "Published Volume AoP - volumes",
        description: "Published volume description",
        _status: "published",
      } as unknown as Volume,
    })

    const result = await payload.findByID({
      collection: "volumes",
      id: published.id,
      overrideAccess: false,
      user: member,
    })

    expect(result.id).toBe(published.id)
  })

  it("allows unauthenticated user to read a published volume", async () => {
    const published = await payload.create({
      collection: "volumes",
      overrideAccess: true,
      context: { disableRevalidate: true },
      data: {
        title: "Published Anon Volume AoP - volumes",
        description: "Published anon volume description",
        _status: "published",
      } as unknown as Volume,
    })

    const result = await payload.findByID({
      collection: "volumes",
      id: published.id,
      overrideAccess: false,
      user: undefined,
    })

    expect(result.id).toBe(published.id)
  })

  it("denies unauthenticated user from reading a draft volume", async () => {
    const draft = await payload.create({
      collection: "volumes",
      overrideAccess: true,
      context: { disableRevalidate: true },
      data: {
        title: "Draft Anon Volume AoP - volumes",
        description: "Draft anon volume description",
        _status: "draft",
      } as unknown as Volume,
    })

    await expect(
      payload.findByID({
        collection: "volumes",
        id: draft.id,
        overrideAccess: false,
        user: undefined,
      }),
    ).rejects.toThrow()
  })

  it("allows authenticated user to find both draft and published volumes", async () => {
    const member = await createUser("member")

    const draft = await payload.create({
      collection: "volumes",
      overrideAccess: true,
      context: { disableRevalidate: true },
      data: {
        title: "Draft Find Volume AoP - volumes",
        description: "Draft find volume description",
        _status: "draft",
      } as unknown as Volume,
    })

    const published = await payload.create({
      collection: "volumes",
      overrideAccess: true,
      context: { disableRevalidate: true },
      data: {
        title: "Published Find Volume AoP - volumes",
        description: "Published find volume description",
        _status: "published",
      } as unknown as Volume,
    })

    const result = await payload.find({
      collection: "volumes",
      overrideAccess: false,
      user: member,
      where: {
        id: { in: [draft.id, published.id] },
      },
    })

    expect(result.docs).toHaveLength(2)
    expect(result.docs.map((d) => d.id)).toEqual(expect.arrayContaining([draft.id, published.id]))
  })

  it("filters draft volumes for unauthenticated user find", async () => {
    const draft = await payload.create({
      collection: "volumes",
      overrideAccess: true,
      context: { disableRevalidate: true },
      data: {
        title: "Draft Find Anon Volume AoP - volumes",
        description: "Draft find anon volume description",
        _status: "draft",
      } as unknown as Volume,
    })

    const published = await payload.create({
      collection: "volumes",
      overrideAccess: true,
      context: { disableRevalidate: true },
      data: {
        title: "Published Find Anon Volume AoP - volumes",
        description: "Published find anon volume description",
        _status: "published",
      } as unknown as Volume,
    })

    const result = await payload.find({
      collection: "volumes",
      overrideAccess: false,
      user: undefined,
      where: {
        id: { in: [draft.id, published.id] },
      },
    })

    expect(result.docs).toHaveLength(1)
    expect(result.docs.map((d) => d.id)).toEqual([published.id])
  })
})
