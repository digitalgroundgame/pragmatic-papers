import { randomUUID } from "node:crypto"
import { getPayloadConfig } from "@/utilities/getPayloadConfig"
import type { User } from "@/payload-types"
import type { Payload } from "payload"

let payloadPromise: Promise<Payload> | null = null

export function getPayload(): Promise<Payload> {
  if (!payloadPromise) {
    payloadPromise = getPayloadConfig()
  }
  return payloadPromise
}

export type Role = "admin" | "chief-editor" | "editor" | "writer" | "narrator" | "member"

export async function createUser(roleOrRoles: Role | Role[]): Promise<User> {
  const payload = await getPayload()
  const roles = Array.isArray(roleOrRoles) ? roleOrRoles : [roleOrRoles]
  const label = roles.join("-")
  const suffix = randomUUID().slice(0, 8)
  const result = await payload.create({
    collection: "users",
    overrideAccess: true,
    context: { disableRevalidate: true },
    data: {
      email: `test-${label}-${suffix}@example.com`,
      password: "test-password",
      name: `${label} test user ${suffix}`,
      roles,
    } as unknown as User,
  })
  return result
}
