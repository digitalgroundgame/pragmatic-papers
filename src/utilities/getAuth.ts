"use server"

import { headers as getHeaders } from "next/headers"
import { type SanitizedPermissions, type TypedUser } from "payload"
import { getPayloadConfig } from "./getPayloadConfig"

export interface AuthResult {
  permissions: SanitizedPermissions
  responseHeaders?: Headers
  user: null | TypedUser
}

export async function getAuth(): Promise<AuthResult> {
  const payload = await getPayloadConfig()
  const headers = await getHeaders()
  return await payload.auth({ headers })
}
