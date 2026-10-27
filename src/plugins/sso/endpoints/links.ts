import type { PostgresAdapter } from "@payloadcms/db-postgres"
import type { Endpoint, PayloadHandler, PayloadRequest } from "payload"

import { configuredProviders, getAuth } from "../auth"
import { LINKS_ENDPOINT_PATH, PROVIDER_LABELS, TABLES } from "../constants"
import type { LinkForUserBody } from "../linking"
import { signedInUser, type SignedInUser } from "../session"
import type { LinkedProvider, ResolvedSsoConfig, SsoProviderId } from "../types"

const notFound = () => Response.json({ message: "Not Found" }, { status: 404 })

/**
 * The signed-in user's links to each configured provider: list them, connect one (which
 * returns the provider's URL to send them to) and disconnect one. Each acts on the signed-in
 * user (`signedInUser`): Payload's `req.user` after a password or provider login, or a
 * member, whose provider session Payload doesn't accept.
 */
export function linkEndpoints(config: ResolvedSsoConfig): Endpoint[] {
  /** The user and the provider a request is about, or the response refusing it. */
  async function resolve(
    req: PayloadRequest,
  ): Promise<{ user: SignedInUser; provider: SsoProviderId | null } | Response> {
    if (!(await config.enabled({ payload: req.payload }))) return notFound()
    const user = await signedInUser(req, config)
    if (!user) return Response.json({ message: "Unauthorized" }, { status: 401 })
    const param = req.routeParams?.provider
    if (param === undefined) return { user, provider: null }
    const provider = configuredProviders(config).find((id) => id === param)
    return provider ? { user, provider } : notFound()
  }

  const pool = (req: PayloadRequest) => (req.payload.db as unknown as PostgresAdapter).pool

  const list: PayloadHandler = async (req) => {
    const resolved = await resolve(req)
    if (resolved instanceof Response) return resolved
    const { rows } = await pool(req).query<{ provider_id: string }>(
      `select distinct provider_id from "${TABLES.account}" where user_id = $1`,
      [String(resolved.user.id)],
    )
    const linked = new Set(rows.map((row) => row.provider_id))
    const providers: LinkedProvider[] = configuredProviders(config).map((id) => ({
      id,
      label: PROVIDER_LABELS[id],
      linked: linked.has(id),
    }))
    return Response.json({ providers })
  }

  const connect: PayloadHandler = async (req) => {
    const resolved = await resolve(req)
    if (resolved instanceof Response) return resolved
    // Back to the page the link was made from: the admin's account page for Payload's users,
    // the site's for members.
    const accountPath = config.isPayloadUser(resolved.user)
      ? `${req.payload.config.routes.admin}/account`
      : config.accountPath
    const body: LinkForUserBody = {
      provider: resolved.provider!,
      userId: String(resolved.user.id),
      email: typeof resolved.user.email === "string" ? resolved.user.email : "",
      callbackURL: `${accountPath}?linked=${resolved.provider}`,
      errorCallbackURL: accountPath,
    }
    const auth = await getAuth(req.payload, config)
    const api = auth.api as unknown as {
      linkForUser: (args: {
        body: LinkForUserBody
        headers: Headers
        asResponse: true
      }) => Promise<Response>
    }
    // The response carries the OAuth state cookie the callback checks.
    return api.linkForUser({ body, headers: req.headers, asResponse: true })
  }

  const disconnect: PayloadHandler = async (req) => {
    const resolved = await resolve(req)
    if (resolved instanceof Response) return resolved
    const db = pool(req)
    const userId = String(resolved.user.id)

    // A member has no password to fall back on: their last sign-in would leave them no way in.
    if (!config.isPayloadUser(resolved.user)) {
      const { rows } = await db.query<{ others: number }>(
        `select count(*)::int as others from "${TABLES.account}"
         where user_id = $1 and provider_id <> $2`,
        [userId, resolved.provider],
      )
      if (!rows[0]?.others) {
        return Response.json(
          { message: "Connect another sign-in before removing your last one." },
          { status: 409 },
        )
      }
    }

    await db.query(`delete from "${TABLES.account}" where user_id = $1 and provider_id = $2`, [
      userId,
      resolved.provider,
    ])

    // Sessions don't record which provider made them, so end every SSO session but this
    // request's own: whoever signed in with the account being removed is signed out.
    const auth = await getAuth(req.payload, config)
    const current = await auth.api
      .getSession({ headers: req.headers, query: { disableRefresh: true } })
      .catch(() => null)
    await db.query(`delete from "${TABLES.session}" where user_id = $1 and id::text <> $2`, [
      userId,
      current?.session.id ?? "",
    ])
    return Response.json({ ok: true })
  }

  return [
    { path: LINKS_ENDPOINT_PATH, method: "get", handler: list },
    { path: `${LINKS_ENDPOINT_PATH}/:provider`, method: "post", handler: connect },
    { path: `${LINKS_ENDPOINT_PATH}/:provider`, method: "delete", handler: disconnect },
  ]
}
