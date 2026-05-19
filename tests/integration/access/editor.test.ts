import { describe, expect, it, beforeAll, afterAll } from "vitest"
import type { Payload } from "payload"
import { getPayload, createUser, destroyPayload } from "../helpers/testUsers"

describe("editor access", () => {
  let payload: Payload

  beforeAll(async () => {
    payload = await getPayload()
  })

  afterAll(async () => {
    await destroyPayload()
  })

  it("allows editor to update a topic", async () => {
    const editor = await createUser("editor")

    const topic = await payload.create({
      collection: "topics",
      overrideAccess: true,
      draft: true,
      data: { name: "Topic Editor Update - editor" },
    })

    const updated = await payload.update({
      collection: "topics",
      id: topic.id,
      overrideAccess: false,
      user: editor,
      data: { name: "Updated by Editor" },
    })

    expect(updated.name).toBe("Updated by Editor")
  })

  it("allows chief-editor to update a topic (editor+)", async () => {
    const chiefEditor = await createUser("chief-editor")

    const topic = await payload.create({
      collection: "topics",
      overrideAccess: true,
      draft: true,
      data: { name: "Topic CE Update - editor" },
    })

    const updated = await payload.update({
      collection: "topics",
      id: topic.id,
      overrideAccess: false,
      user: chiefEditor,
      data: { name: "Updated by Chief Editor" },
    })

    expect(updated.name).toBe("Updated by Chief Editor")
  })

  it("allows admin to update a topic (editor+)", async () => {
    const admin = await createUser("admin")

    const topic = await payload.create({
      collection: "topics",
      overrideAccess: true,
      draft: true,
      data: { name: "Topic Admin Update - editor" },
    })

    const updated = await payload.update({
      collection: "topics",
      id: topic.id,
      overrideAccess: false,
      user: admin,
      data: { name: "Updated by Admin" },
    })

    expect(updated.name).toBe("Updated by Admin")
  })

  it("allows editor to delete a topic", async () => {
    const editor = await createUser("editor")

    const topic = await payload.create({
      collection: "topics",
      overrideAccess: true,
      draft: true,
      data: { name: "Topic Editor Delete - editor" },
    })

    const deleted = await payload.delete({
      collection: "topics",
      id: topic.id,
      overrideAccess: false,
      user: editor,
    })

    expect(deleted.id).toBe(topic.id)
  })

  it("denies writer from updating a topic (writer < editor)", async () => {
    const writer = await createUser("writer")

    const topic = await payload.create({
      collection: "topics",
      overrideAccess: true,
      draft: true,
      data: { name: "Topic Writer No Update - editor" },
    })

    await expect(
      payload.update({
        collection: "topics",
        id: topic.id,
        overrideAccess: false,
        user: writer,
        data: { name: "Should Not Update" },
      }),
    ).rejects.toThrow()
  })

  it("denies writer from deleting a topic (writer < editor)", async () => {
    const writer = await createUser("writer")

    const topic = await payload.create({
      collection: "topics",
      overrideAccess: true,
      draft: true,
      data: { name: "Topic Writer No Delete - editor" },
    })

    await expect(
      payload.delete({
        collection: "topics",
        id: topic.id,
        overrideAccess: false,
        user: writer,
      }),
    ).rejects.toThrow()
  })
})
