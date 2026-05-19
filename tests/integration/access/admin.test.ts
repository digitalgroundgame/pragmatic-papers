import { randomUUID } from "node:crypto"
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
    const suffix = randomUUID().slice(0, 8)
    const email = `created-by-admin-${suffix}@example.com`

    const newUser = await payload.create({
      collection: "users",
      overrideAccess: false,
      user: admin,
      context: { disableRevalidate: true },
      data: {
        email,
        password: "test-password",
        name: `Created by Admin - ${suffix}`,
      } as unknown as User,
    })

    expect(newUser).toBeDefined()
    expect(newUser.email).toBe(email)
  })

  it("allows chief-editor to create a user (equivalent to admin)", async () => {
    const chiefEditor = await createUser("chief-editor")
    const suffix = randomUUID().slice(0, 8)
    const email = `created-by-chief-editor-${suffix}@example.com`

    const newUser = await payload.create({
      collection: "users",
      overrideAccess: false,
      user: chiefEditor,
      context: { disableRevalidate: true },
      data: {
        email,
        password: "test-password",
        name: `Created by Chief Editor - ${suffix}`,
      } as unknown as User,
    })

    expect(newUser).toBeDefined()
    expect(newUser.email).toBe(email)
  })

  it("denies editor from creating a user", async () => {
    const editor = await createUser("editor")
    const suffix = randomUUID().slice(0, 8)

    await expect(
      payload.create({
        collection: "users",
        overrideAccess: false,
        user: editor,
        context: { disableRevalidate: true },
        data: {
          email: `denied-editor-${suffix}@example.com`,
          password: "test-password",
          name: `Should Not Create - ${suffix}`,
        } as unknown as User,
      }),
    ).rejects.toThrow()
  })

  it("denies member from creating a user", async () => {
    const member = await createUser("member")
    const suffix = randomUUID().slice(0, 8)

    await expect(
      payload.create({
        collection: "users",
        overrideAccess: false,
        user: member,
        context: { disableRevalidate: true },
        data: {
          email: `denied-member-${suffix}@example.com`,
          password: "test-password",
          name: `Should Not Create - ${suffix}`,
        } as unknown as User,
      }),
    ).rejects.toThrow()
  })

  it("denies unauthenticated from creating a user", async () => {
    const suffix = randomUUID().slice(0, 8)

    await expect(
      payload.create({
        collection: "users",
        overrideAccess: false,
        user: undefined,
        context: { disableRevalidate: true },
        data: {
          email: `denied-anon-${suffix}@example.com`,
          password: "test-password",
          name: `Should Not Create Anon - ${suffix}`,
        } as unknown as User,
      }),
    ).rejects.toThrow()
  })

  it("denies unauthenticated from deleting a user", async () => {
    const suffix = randomUUID().slice(0, 8)
    const target = await payload.create({
      collection: "users",
      overrideAccess: true,
      context: { disableRevalidate: true },
      data: {
        email: `delete-target-${suffix}@example.com`,
        password: "test-password",
        name: `Delete Target - ${suffix}`,
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
