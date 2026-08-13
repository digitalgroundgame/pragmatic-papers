import { describe, expect, it, beforeAll } from "vitest"
import type { Payload } from "payload"
import { getPayload, createUser } from "../helpers/testUsers"

describe("isSelfOrAdmin access", () => {
  let payload: Payload

  beforeAll(async () => {
    payload = await getPayload()
  })

  it("admin can read any user", async () => {
    const admin = await createUser("admin")
    const otherUser = await createUser("member")

    const result = await payload.findByID({
      collection: "users",
      id: otherUser.id,
      overrideAccess: false,
      user: admin,
    })

    expect(result.id).toBe(otherUser.id)
  })

  it("non-admin can only read their own user record", async () => {
    const member = await createUser("member")
    const otherUser = await createUser("member")

    // Payload's findByID with overrideAccess: false throws a NotFound-like
    // error when the record is filtered out by access control (same as if it
    // didn't exist), rather than returning null.
    await expect(
      payload.findByID({
        collection: "users",
        id: otherUser.id,
        overrideAccess: false,
        user: member,
      }),
    ).rejects.toThrow()
  })

  it("non-admin can read their own user record", async () => {
    const member = await createUser("member")

    const result = await payload.findByID({
      collection: "users",
      id: member.id,
      overrideAccess: false,
      user: member,
    })

    expect(result.id).toBe(member.id)
  })

  it("anyone can read staff users (writers, editors, etc.)", async () => {
    const writer = await createUser("writer")
    const member = await createUser("member")

    // Another member can read the writer
    const resultByMember = await payload.findByID({
      collection: "users",
      id: writer.id,
      overrideAccess: false,
      user: member,
    })
    expect(resultByMember.id).toBe(writer.id)

    // Unauthenticated user can read the writer
    const resultByAnon = await payload.findByID({
      collection: "users",
      id: writer.id,
      overrideAccess: false,
      user: null,
    })
    expect(resultByAnon.id).toBe(writer.id)
  })

  it("unauthenticated user cannot read member users", async () => {
    const member = await createUser("member")

    await expect(
      payload.findByID({
        collection: "users",
        id: member.id,
        overrideAccess: false,
        user: null,
      }),
    ).rejects.toThrow()
  })

  it("admin can update any user", async () => {
    const admin = await createUser("admin")
    const otherUser = await createUser("member")

    const updated = await payload.update({
      collection: "users",
      id: otherUser.id,
      overrideAccess: false,
      user: admin,
      context: { disableRevalidate: true },
      data: { name: "Updated by Admin" },
    })

    expect(updated.name).toBe("Updated by Admin")
  })

  it("non-admin can update only their own user record", async () => {
    const member = await createUser("member")
    const otherUser = await createUser("member")

    const updated = await payload.update({
      collection: "users",
      id: member.id,
      overrideAccess: false,
      user: member,
      context: { disableRevalidate: true },
      data: { name: "Updated Self" },
    })
    expect(updated.name).toBe("Updated Self")

    await expect(
      payload.update({
        collection: "users",
        id: otherUser.id,
        overrideAccess: false,
        user: member,
        context: { disableRevalidate: true },
        data: { name: "Should Not Update" },
      }),
    ).rejects.toThrow()
  })
})
