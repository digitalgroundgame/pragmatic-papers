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

export type Role = NonNullable<User["role"]>

export async function createUser(role: Role): Promise<User> {
  const payload = await getPayload()
  const suffix = randomUUID().slice(0, 8)
  const result = await payload.create({
    collection: "users",
    overrideAccess: true,
    context: { disableRevalidate: true },
    data: {
      email: `test-${role}-${suffix}@example.com`,
      password: "test-password",
      name: `${role} test user ${suffix}`,
      role,
    } as unknown as User,
  })
  return result
}
