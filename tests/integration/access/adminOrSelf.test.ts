/* eslint-disable @typescript-eslint/no-explicit-any */
import { getPayloadConfig } from "@/utilities/getPayloadConfig"
import type { Payload } from "payload"
import { beforeAll, describe, expect, it } from "vitest"

describe("adminOrSelf access", () => {
  let payload: Payload

  beforeAll(async () => {
    payload = await getPayloadConfig()
  })

  it("admin can read any user", async () => {
    const admin = await payload.create({
      collection: "users",
      overrideAccess: true,
      context: { disableRevalidate: true },
      data: {
        email: "admin-read-aos@example.com",
        password: "test-password",
        name: "Admin Read - aos",
        role: "admin",
      },
    } as any)

    const otherUser = await payload.create({
      collection: "users",
      overrideAccess: true,
      context: { disableRevalidate: true },
      data: {
        email: "other-user-aos@example.com",
        password: "test-password",
        name: "Other User - aos",
        role: "member",
      },
    } as any)

    const result = await payload.findByID({
      collection: "users",
      id: otherUser.id,
      overrideAccess: false,
      user: admin,
    })

    expect(result.id).toBe(otherUser.id)
  })

  it("non-admin can only read their own user record", async () => {
    const member = await payload.create({
      collection: "users",
      overrideAccess: true,
      context: { disableRevalidate: true },
      data: {
        email: "member-read-aos@example.com",
        password: "test-password",
        name: "Member Read - aos",
        role: "member",
      },
    } as any)

    const otherUser = await payload.create({
      collection: "users",
      overrideAccess: true,
      context: { disableRevalidate: true },
      data: {
        email: "other-user-self-aos@example.com",
        password: "test-password",
        name: "Other User Self - aos",
        role: "member",
      },
    } as any)

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
    const member = await payload.create({
      collection: "users",
      overrideAccess: true,
      context: { disableRevalidate: true },
      data: {
        email: "member-self-aos@example.com",
        password: "test-password",
        name: "Member Self - aos",
        role: "member",
      },
    } as any)

    const result = await payload.findByID({
      collection: "users",
      id: member.id,
      overrideAccess: false,
      user: member,
    })

    expect(result.id).toBe(member.id)
  })

  it("admin can update any user", async () => {
    const admin = await payload.create({
      collection: "users",
      overrideAccess: true,
      context: { disableRevalidate: true },
      data: {
        email: "admin-update-aos@example.com",
        password: "test-password",
        name: "Admin Update - aos",
        role: "admin",
      },
    } as any)

    const otherUser = await payload.create({
      collection: "users",
      overrideAccess: true,
      context: { disableRevalidate: true },
      data: {
        email: "other-update-aos@example.com",
        password: "test-password",
        name: "Other Update - aos",
        role: "member",
      },
    } as any)

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
    const member = await payload.create({
      collection: "users",
      overrideAccess: true,
      context: { disableRevalidate: true },
      data: {
        email: "member-update-aos@example.com",
        password: "test-password",
        name: "Member Update - aos",
        role: "member",
      },
    } as any)

    const otherUser = await payload.create({
      collection: "users",
      overrideAccess: true,
      context: { disableRevalidate: true },
      data: {
        email: "other-update-denied-aos@example.com",
        password: "test-password",
        name: "Other Update Denied - aos",
        role: "member",
      },
    } as any)

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
