import type { Endpoint, PayloadHandler } from "payload"

import { getAuth } from "../auth"
import { AUTH_ENDPOINT_PATH } from "../constants"
import type { ResolvedSsoConfig } from "../types"

/**
 * Better Auth's own routes (`/api/auth/sign-in/social`, `/api/auth/callback/<provider>`, …),
 * served through Payload's REST handler.
 */
export function authEndpoints(config: ResolvedSsoConfig): Endpoint[] {
  const handler: PayloadHandler = async (req) => {
    if (!(await config.enabled({ payload: req.payload }))) {
      return Response.json({ message: "Not Found" }, { status: 404 })
    }
    // A plain Request: Better Auth reads the body itself, and Payload hasn't.
    const hasBody = req.method !== "GET" && req.method !== "HEAD"
    const request = new Request(req.url!, {
      method: req.method,
      headers: req.headers,
      ...(hasBody && { body: req.body, duplex: "half" }),
    } as RequestInit)
    const auth = await getAuth(req.payload, config)
    return auth.handler(request)
  }

  return (["get", "post"] as const).map((method) => ({
    path: `${AUTH_ENDPOINT_PATH}/:path*`,
    method,
    handler,
  }))
}
