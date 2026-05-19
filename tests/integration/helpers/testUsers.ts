import { randomUUID } from "node:crypto"
import { getPayloadConfig } from "@/utilities/getPayloadConfig"
import type { User } from "@/payload-types"
import type { Payload } from "payload"

let payloadInstance: Payload | null = null
let payloadInitPromise: Promise<Payload> | null = null

export async function getPayload(): Promise<Payload> {
  if (payloadInitPromise) {
    return await payloadInitPromise
  }
  if (!payloadInstance) {
    payloadInitPromise = getPayloadConfig()
    payloadInstance = await payloadInitPromise
    payloadInitPromise = null
  }
  return payloadInstance
}

export async function destroyPayload(): Promise<void> {
  if (payloadInstance) {
    await payloadInstance.db.destroy?.()
    payloadInstance = null
  }
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
