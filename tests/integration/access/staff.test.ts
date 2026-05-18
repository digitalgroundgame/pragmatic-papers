import { staff } from "@/access/staff"
/* eslint-disable @typescript-eslint/no-explicit-any */
import { getPayloadConfig } from "@/utilities/getPayloadConfig"
import type { Payload } from "payload"
import { beforeAll, describe, expect, it } from "vitest"

describe("staff access", () => {
  let payload: Payload

  beforeAll(async () => {
    payload = await getPayloadConfig()
  })

  it("allows narrator and above to access admin (staff)", async () => {
    const roles = ["narrator", "writer", "editor", "chief-editor", "admin"] as const

    for (const role of roles) {
      const user = await payload.create({
        collection: "users",
        overrideAccess: true,
        context: { disableRevalidate: true },
        data: {
          email: `${role}-staff@example.com`,
          password: "test-password",
          name: `${role} Staff`,
          role,
        },
      } as any)

      const isStaff = staff({ req: { user, payload } as any })
      expect(isStaff, `Role ${role} should be staff`).toBe(true)
    }
  })

  it("denies member from admin access (not staff)", async () => {
    const member = await payload.create({
      collection: "users",
      overrideAccess: true,
      context: { disableRevalidate: true },
      data: {
        email: "member-staff@example.com",
        password: "test-password",
        name: "Member Staff",
        role: "member",
      },
    } as any)

    const isStaff = staff({ req: { user: member, payload } as any })
    expect(isStaff).toBe(false)
  })

  it("denies unauthenticated from admin access", async () => {
    const isStaff = staff({ req: { user: null, payload } as any })
    expect(isStaff).toBe(false)
  })
})
