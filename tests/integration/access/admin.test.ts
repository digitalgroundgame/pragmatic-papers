/* eslint-disable @typescript-eslint/no-explicit-any */
import { getPayloadConfig } from "@/utilities/getPayloadConfig"
import type { Payload } from "payload"
import { beforeAll, describe, expect, it } from "vitest"

describe("admin access", () => {
  let payload: Payload

  beforeAll(async () => {
    payload = await getPayloadConfig()
  })

  it("allows admin to create a user", async () => {
    const admin = await payload.create({
      collection: "users",
      overrideAccess: true,
      context: { disableRevalidate: true },
      data: {
        email: "admin-create-admin@example.com",
        password: "test-password",
        name: "Admin Create Test - admin",
        role: "admin",
      },
    } as any)

    const newUser = await payload.create({
      collection: "users",
      overrideAccess: false,
      user: admin,
      context: { disableRevalidate: true },
      data: {
        email: "created-by-admin-admin@example.com",
        password: "test-password",
        name: "Created by Admin - admin",
      },
    } as any)

    expect(newUser).toBeDefined()
    expect((newUser as any).email).toBe("created-by-admin-admin@example.com")
  })

  it("allows chief-editor to create a user (equivalent to admin)", async () => {
    const chiefEditor = await payload.create({
      collection: "users",
      overrideAccess: true,
      context: { disableRevalidate: true },
      data: {
        email: "chief-editor-create-admin@example.com",
        password: "test-password",
        name: "Chief Editor Create Test - admin",
        role: "chief-editor",
      },
    } as any)

    const newUser = await payload.create({
      collection: "users",
      overrideAccess: false,
      user: chiefEditor,
      context: { disableRevalidate: true },
      data: {
        email: "created-by-chief-editor-admin@example.com",
        password: "test-password",
        name: "Created by Chief Editor - admin",
      },
    } as any)

    expect(newUser).toBeDefined()
    expect((newUser as any).email).toBe("created-by-chief-editor-admin@example.com")
  })

  it("denies editor from creating a user", async () => {
    const editor = await payload.create({
      collection: "users",
      overrideAccess: true,
      context: { disableRevalidate: true },
      data: {
        email: "editor-create-admin@example.com",
        password: "test-password",
        name: "Editor Create Test - admin",
        role: "editor",
      },
    } as any)

    await expect(
      payload.create({
        collection: "users",
        overrideAccess: false,
        user: editor,
        context: { disableRevalidate: true },
        data: {
          email: "denied-editor-admin@example.com",
          password: "test-password",
          name: "Should Not Create - admin",
        },
      } as any),
    ).rejects.toThrow()
  })

  it("denies member from creating a user", async () => {
    const member = await payload.create({
      collection: "users",
      overrideAccess: true,
      context: { disableRevalidate: true },
      data: {
        email: "member-create-admin@example.com",
        password: "test-password",
        name: "Member Create Test - admin",
        role: "member",
      },
    } as any)

    await expect(
      payload.create({
        collection: "users",
        overrideAccess: false,
        user: member,
        context: { disableRevalidate: true },
        data: {
          email: "denied-member-admin@example.com",
          password: "test-password",
          name: "Should Not Create - admin",
        },
      } as any),
    ).rejects.toThrow()
  })
})
