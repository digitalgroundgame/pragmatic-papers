import { describe, expect, it, beforeAll } from "vitest"
import type { Payload } from "payload"
import type { User } from "@/payload-types"
import { getPayload, createUser } from "../helpers/testUsers"

describe("admin access", () => {
  let payload: Payload

  beforeAll(async () => {
    payload = await getPayload()
  })

  it("allows admin to create a user", async () => {
    const admin = await createUser("admin")

    const newUser = await payload.create({
      collection: "users",
      overrideAccess: false,
      user: admin,
      context: { disableRevalidate: true },
      data: {
        email: "created-by-admin-admin@example.com",
        password: "test-password",
        name: "Created by Admin - admin",
      } as unknown as User,
    })

    expect(newUser).toBeDefined()
    expect(newUser.email).toBe("created-by-admin-admin@example.com")
  })

  it("allows chief-editor to create a user (equivalent to admin)", async () => {
    const chiefEditor = await createUser("chief-editor")

    const newUser = await payload.create({
      collection: "users",
      overrideAccess: false,
      user: chiefEditor,
      context: { disableRevalidate: true },
      data: {
        email: "created-by-chief-editor-admin@example.com",
        password: "test-password",
        name: "Created by Chief Editor - admin",
      } as unknown as User,
    })

    expect(newUser).toBeDefined()
    expect(newUser.email).toBe("created-by-chief-editor-admin@example.com")
  })

  it("denies editor from creating a user", async () => {
    const editor = await createUser("editor")

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
        } as unknown as User,
      }),
    ).rejects.toThrow()
  })

  it("denies member from creating a user", async () => {
    const member = await createUser("member")

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
        } as unknown as User,
      }),
    ).rejects.toThrow()
  })

  it("denies unauthenticated from creating a user", async () => {
    await expect(
      payload.create({
        collection: "users",
        overrideAccess: false,
        user: undefined,
        context: { disableRevalidate: true },
        data: {
          email: "denied-anon-admin@example.com",
          password: "test-password",
          name: "Should Not Create Anon - admin",
        } as unknown as User,
      }),
    ).rejects.toThrow()
  })

  it("denies unauthenticated from deleting a user", async () => {
    const target = await payload.create({
      collection: "users",
      overrideAccess: true,
      context: { disableRevalidate: true },
      data: {
        email: "delete-target-admin@example.com",
        password: "test-password",
        name: "Delete Target - admin",
      } as unknown as User,
    })

    await expect(
      payload.delete({
        collection: "users",
        id: target.id,
        overrideAccess: false,
        user: undefined,
        context: { disableRevalidate: true },
      }),
    ).rejects.toThrow()
  })
})
