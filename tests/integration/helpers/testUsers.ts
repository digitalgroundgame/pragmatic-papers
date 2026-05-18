/* eslint-disable @typescript-eslint/no-explicit-any */
import { getPayloadConfig } from "@/utilities/getPayloadConfig"
import type { User } from "@/payload-types"
import type { Payload } from "payload"

let payloadInstance: Payload | null = null

export async function getPayload(): Promise<Payload> {
  if (!payloadInstance) {
    payloadInstance = await getPayloadConfig()
  }
  return payloadInstance
}

export type Role = NonNullable<User["role"]>

export async function createUser(role: Role, email: string): Promise<User> {
  const payload = await getPayload()
  const result = await payload.create({
    collection: "users",
    overrideAccess: true,
    context: { disableRevalidate: true },
    data: {
      email,
      password: "test-password",
      name: `${role} test user`,
      role,
    },
  } as any)
  return result as User
}

export async function cleanupUsers(): Promise<void> {
  const payload = await getPayload()
  const result = await payload.find({
    collection: "users",
    overrideAccess: true,
    limit: 0,
    pagination: false,
  })
  for (const user of result.docs) {
    await payload.delete({
      collection: "users",
      id: user.id,
      overrideAccess: true,
      context: { disableRevalidate: true },
    })
  }
}
