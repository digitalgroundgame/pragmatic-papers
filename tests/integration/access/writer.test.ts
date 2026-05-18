/* eslint-disable @typescript-eslint/no-explicit-any */
import { getPayloadConfig } from "@/utilities/getPayloadConfig"
import type { Payload } from "payload"
import { beforeAll, describe, expect, it } from "vitest"

describe("writer access", () => {
  let payload: Payload

  beforeAll(async () => {
    payload = await getPayloadConfig()
  })

  it("allows writer to create a topic", async () => {
    const writer = await payload.create({
      collection: "users",
      overrideAccess: true,
      context: { disableRevalidate: true },
      data: {
        email: "writer-topic-writer@example.com",
        password: "test-password",
        name: "Writer Topic - writer",
        role: "writer",
      },
    } as any)

    const topic = await payload.create({
      collection: "topics",
      overrideAccess: false,
      user: writer,
      draft: true,
      data: { name: "Topic by Writer - writer" },
    })

    expect(topic).toBeDefined()
    expect((topic as any).name).toBe("Topic by Writer - writer")
  })

  it("allows editor to create a topic (writer+)", async () => {
    const editor = await payload.create({
      collection: "users",
      overrideAccess: true,
      context: { disableRevalidate: true },
      data: {
        email: "editor-topic-writer@example.com",
        password: "test-password",
        name: "Editor Topic - writer",
        role: "editor",
      },
    } as any)

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
    const admin = await payload.create({
      collection: "users",
      overrideAccess: true,
      context: { disableRevalidate: true },
      data: {
        email: "admin-topic-writer@example.com",
        password: "test-password",
        name: "Admin Topic - writer",
        role: "admin",
      },
    } as any)

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
    const narrator = await payload.create({
      collection: "users",
      overrideAccess: true,
      context: { disableRevalidate: true },
      data: {
        email: "narrator-topic-writer@example.com",
        password: "test-password",
        name: "Narrator Topic - writer",
        role: "narrator",
      },
    } as any)

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
    const member = await payload.create({
      collection: "users",
      overrideAccess: true,
      context: { disableRevalidate: true },
      data: {
        email: "member-topic-writer@example.com",
        password: "test-password",
        name: "Member Topic - writer",
        role: "member",
      },
    } as any)

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
        user: undefined as any,
        draft: true,
        data: { name: "Should Not Create Topic Anon - writer" },
      }),
    ).rejects.toThrow()
  })
})
