import { describe, expect, it, beforeAll } from "vitest"
import type { Payload } from "payload"
import { getPayload, createUser } from "../helpers/testUsers"

describe("writer access", () => {
  let payload: Payload

  beforeAll(async () => {
    payload = await getPayload()
  })

  it("allows writer to create a topic", async () => {
    const writer = await createUser("writer")

    const topic = await payload.create({
      collection: "topics",
      overrideAccess: false,
      user: writer,
      draft: true,
      data: { name: "Topic by Writer - writer" },
    })

    expect(topic).toBeDefined()
    expect(topic.name).toBe("Topic by Writer - writer")
  })

  it("allows editor to create a topic (writer+)", async () => {
    const editor = await createUser("editor")

    const topic = await payload.create({
      collection: "topics",
      overrideAccess: false,
      user: editor,
      draft: true,
      data: { name: "Topic by Editor - writer" },
    })

    expect(topic).toBeDefined()
  })

  it("allows admin to create a topic (writer+)", async () => {
    const admin = await createUser("admin")

    const topic = await payload.create({
      collection: "topics",
      overrideAccess: false,
      user: admin,
      draft: true,
      data: { name: "Topic by Admin - writer" },
    })

    expect(topic).toBeDefined()
  })

  it("denies narrator from creating a topic (narrator < writer)", async () => {
    const narrator = await createUser("narrator")

    await expect(
      payload.create({
        collection: "topics",
        overrideAccess: false,
        user: narrator,
        draft: true,
        data: { name: "Should Not Create Topic - writer" },
      }),
    ).rejects.toThrow()
  })

  it("denies member from creating a topic (member < writer)", async () => {
    const member = await createUser("member")

    await expect(
      payload.create({
        collection: "topics",
        overrideAccess: false,
        user: member,
        draft: true,
        data: { name: "Should Not Create Topic - writer" },
      }),
    ).rejects.toThrow()
  })

  it("denies unauthenticated from creating a topic", async () => {
    await expect(
      payload.create({
        collection: "topics",
        overrideAccess: false,
        user: undefined,
        draft: true,
        data: { name: "Should Not Create Topic Anon - writer" },
      }),
    ).rejects.toThrow()
  })

  it("denies unauthenticated from updating a topic", async () => {
    const topic = await payload.create({
      collection: "topics",
      overrideAccess: true,
      draft: true,
      data: { name: "Anon Update Topic - writer" },
    })

    await expect(
      payload.update({
        collection: "topics",
        id: topic.id,
        overrideAccess: false,
        user: undefined,
        data: { name: "Should Not Update" },
      }),
    ).rejects.toThrow()
  })

  it("denies unauthenticated from deleting a topic", async () => {
    const topic = await payload.create({
      collection: "topics",
      overrideAccess: true,
      draft: true,
      data: { name: "Anon Delete Topic - writer" },
    })

    await expect(
      payload.delete({
        collection: "topics",
        id: topic.id,
        overrideAccess: false,
        user: undefined,
      }),
    ).rejects.toThrow()
  })
})
