/* eslint-disable @typescript-eslint/no-explicit-any */
import { getPayloadConfig } from "@/utilities/getPayloadConfig"
import type { Payload } from "payload"
import { beforeAll, describe, expect, it } from "vitest"

describe("editor access", () => {
  let payload: Payload

  beforeAll(async () => {
    payload = await getPayloadConfig()
  })

  it("allows editor to update a topic", async () => {
    const editor = await payload.create({
      collection: "users",
      overrideAccess: true,
      context: { disableRevalidate: true },
      data: {
        email: "editor-update-topic-editor@example.com",
        password: "test-password",
        name: "Editor Update - editor",
        role: "editor",
      },
    } as any)

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

    expect((updated as any).name).toBe("Updated by Editor")
  })

  it("allows chief-editor to update a topic (editor+)", async () => {
    const chiefEditor = await payload.create({
      collection: "users",
      overrideAccess: true,
      context: { disableRevalidate: true },
      data: {
        email: "chief-editor-update-topic-editor@example.com",
        password: "test-password",
        name: "Chief Editor Update - editor",
        role: "chief-editor",
      },
    } as any)

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

    expect((updated as any).name).toBe("Updated by Chief Editor")
  })

  it("allows admin to update a topic (editor+)", async () => {
    const admin = await payload.create({
      collection: "users",
      overrideAccess: true,
      context: { disableRevalidate: true },
      data: {
        email: "admin-update-topic-editor@example.com",
        password: "test-password",
        name: "Admin Update - editor",
        role: "admin",
      },
    } as any)

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

    expect((updated as any).name).toBe("Updated by Admin")
  })

  it("allows editor to delete a topic", async () => {
    const editor = await payload.create({
      collection: "users",
      overrideAccess: true,
      context: { disableRevalidate: true },
      data: {
        email: "editor-delete-topic-editor@example.com",
        password: "test-password",
        name: "Editor Delete - editor",
        role: "editor",
      },
    } as any)

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
    const writer = await payload.create({
      collection: "users",
      overrideAccess: true,
      context: { disableRevalidate: true },
      data: {
        email: "writer-no-update-editor@example.com",
        password: "test-password",
        name: "Writer No Update - editor",
        role: "writer",
      },
    } as any)

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
    const writer = await payload.create({
      collection: "users",
      overrideAccess: true,
      context: { disableRevalidate: true },
      data: {
        email: "writer-no-delete-editor@example.com",
        password: "test-password",
        name: "Writer No Delete - editor",
        role: "writer",
      },
    } as any)

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
