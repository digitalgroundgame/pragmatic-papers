/* eslint-disable @typescript-eslint/no-explicit-any */
import { staff } from "@/access/roles"
import { describe, expect, it, beforeAll, afterAll } from "vitest"
import type { Payload } from "payload"
import { getPayload, createUser, destroyPayload } from "../helpers/testUsers"

describe("staff access", () => {
  let payload: Payload

  beforeAll(async () => {
    payload = await getPayload()
  })

  afterAll(async () => {
    await destroyPayload()
  })

  it("allows narrator and above to access admin (staff)", async () => {
    const roles = ["narrator", "writer", "editor", "chief-editor", "admin"] as const

    for (const role of roles) {
      const user = await createUser(role)

      const isStaff = staff({ req: { user, payload } as any })
      expect(isStaff, `Role ${role} should be staff`).toBe(true)
    }
  })

  it("denies member from admin access (not staff)", async () => {
    const member = await createUser("member")

    const isStaff = staff({ req: { user: member, payload } as any })
    expect(isStaff).toBe(false)
  })

  it("denies unauthenticated from admin access", async () => {
    const isStaff = staff({ req: { user: null, payload } as any })
    expect(isStaff).toBe(false)
  })
})
