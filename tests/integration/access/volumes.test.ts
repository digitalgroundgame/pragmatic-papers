import { describe, expect, it, beforeAll, afterAll } from "vitest"
import type { Payload } from "payload"
import type { Volume } from "@/payload-types"
import { getPayload, createUser, destroyPayload } from "../helpers/testUsers"

describe("volumes authenticatedOrPublished access", () => {
  let payload: Payload

  beforeAll(async () => {
    payload = await getPayload()
  })

  afterAll(async () => {
    await destroyPayload()
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
})
