import type { Endpoint, PayloadHandler } from "payload"

import { getReaderAuth } from "../auth"
import { READER_AUTH_PATH } from "../constants"
import type { ResolvedCommentsConfig } from "../types"

/**
 * Better Auth's routes for readers (`/api/reader-auth/sign-in/social`,
 * `/api/reader-auth/callback/<provider>`, `/api/reader-auth/sign-out`, …), served through
 * Payload's REST handler.
 */
export function readerAuthEndpoints(config: ResolvedCommentsConfig): Endpoint[] {
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
    const auth = await getReaderAuth(req.payload, config)
    return auth.handler(request)
  }

  return (["get", "post"] as const).map((method) => ({
    path: `${READER_AUTH_PATH}/:path*`,
    method,
    handler,
  }))
}
