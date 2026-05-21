import { describe, expect, it, beforeAll } from "vitest"
import type { Payload } from "payload"
import type { Volume } from "@/payload-types"
import { getPayload, createUser } from "../helpers/testUsers"

describe("volumes staffOrPublished access", () => {
  let payload: Payload

  beforeAll(async () => {
    payload = await getPayload()
  })

  it("allows staff user to read a draft volume", async () => {
    const editor = await createUser("editor")

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
      user: editor,
    })

    expect(result.id).toBe(draft.id)
  })

  it("denies member user from reading a draft volume", async () => {
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

    await expect(
      payload.findByID({
        collection: "volumes",
        id: draft.id,
        overrideAccess: false,
        user: member,
      }),
    ).rejects.toThrow()
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

  it("allows staff user to find both draft and published volumes", async () => {
    const editor = await createUser("editor")

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
      user: editor,
      where: {
        id: { in: [draft.id, published.id] },
      },
    })

    expect(result.docs).toHaveLength(2)
    expect(result.docs.map((d) => d.id)).toEqual(expect.arrayContaining([draft.id, published.id]))
  })

  it("filters draft volumes for member user find", async () => {
    const member = await createUser("member")

    const draft = await payload.create({
      collection: "volumes",
      overrideAccess: true,
      context: { disableRevalidate: true },
      data: {
        title: "Draft Find Member Volume AoP - volumes",
        description: "Draft find member volume description",
        _status: "draft",
      } as unknown as Volume,
    })

    const published = await payload.create({
      collection: "volumes",
      overrideAccess: true,
      context: { disableRevalidate: true },
      data: {
        title: "Published Find Member Volume AoP - volumes",
        description: "Published find member volume description",
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

    expect(result.docs).toHaveLength(1)
    expect(result.docs.map((d) => d.id)).toEqual([published.id])
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

  it("denies unauthenticated user from creating a volume", async () => {
    await expect(
      payload.create({
        collection: "volumes",
        overrideAccess: false,
        context: { disableRevalidate: true },
        data: {
          title: "Unauthenticated Create Volume - volumes",
          description: "Should not create",
          _status: "draft",
        } as unknown as Volume,
        user: undefined,
      }),
    ).rejects.toThrow()
  })

  it("denies unauthenticated user from updating a volume", async () => {
    const volume = await payload.create({
      collection: "volumes",
      overrideAccess: true,
      context: { disableRevalidate: true },
      data: {
        title: "Unauthenticated Update Volume - volumes",
        description: "Should not update",
        _status: "draft",
      } as unknown as Volume,
    })

    await expect(
      payload.update({
        collection: "volumes",
        id: volume.id,
        overrideAccess: false,
        user: undefined,
        context: { disableRevalidate: true },
        data: { title: "Should Not Update" },
      }),
    ).rejects.toThrow()
  })

  it("denies unauthenticated user from deleting a volume", async () => {
    const volume = await payload.create({
      collection: "volumes",
      overrideAccess: true,
      context: { disableRevalidate: true },
      data: {
        title: "Unauthenticated Delete Volume - volumes",
        description: "Should not delete",
        _status: "draft",
      } as unknown as Volume,
    })

    await expect(
      payload.delete({
        collection: "volumes",
        id: volume.id,
        overrideAccess: false,
        user: undefined,
        context: { disableRevalidate: true },
      }),
    ).rejects.toThrow()
  })
})
