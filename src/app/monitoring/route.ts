const RATE_LIMIT_HEADERS = ["x-sentry-rate-limits", "retry-after"]

function readEnvelopeDsn(header: string): string | undefined {
  try {
    const { dsn } = JSON.parse(header) as { dsn?: unknown }
    return typeof dsn === "string" ? dsn : undefined
  } catch {
    return undefined
  }
}

function parseDsn(dsn: string | undefined): { host: string; projectId: string } | null {
  if (!dsn) return null
  try {
    const url = new URL(dsn)
    const projectId = url.pathname.split("/").filter(Boolean).pop()
    return projectId ? { host: url.host, projectId } : null
  } catch {
    return null
  }
}

/**
 * Forwards the browser SDK's reports to Sentry from our own origin, so ad blockers that
 * block sentry.io don't drop them. `src/sentrySdk.ts` points the SDK's `tunnel` here.
 *
 * This replaces `withSentryConfig`'s `tunnelRoute`, a Next.js rewrite to sentry.io. Next
 * proxies an external rewrite through httpxy, which adds seven `close` listeners to the
 * response on top of the four Next.js and Sentry's server SDK add to every request, so
 * each report logged a MaxListenersExceededWarning (11 listeners, limit 10).
 * The rewrite also forwarded to any Sentry organisation and project named in its query
 * string; this only forwards envelopes for our own DSN.
 */
export async function POST(request: Request): Promise<Response> {
  const dsn = parseDsn(process.env.SENTRY_DSN)
  if (!dsn) return new Response(null, { status: 404 })

  const envelope = await request.arrayBuffer()
  // An envelope starts with one line of JSON, its header, which names the DSN it's for.
  const headerEnd = new Uint8Array(envelope).indexOf(0x0a)
  const header = new TextDecoder().decode(
    headerEnd === -1 ? envelope : envelope.slice(0, headerEnd),
  )
  const target = parseDsn(readEnvelopeDsn(header))
  if (!target || target.host !== dsn.host || target.projectId !== dsn.projectId) {
    return new Response(null, { status: 400 })
  }

  try {
    const upstream = await fetch(`https://${dsn.host}/api/${dsn.projectId}/envelope/`, {
      method: "POST",
      headers: { "Content-Type": "application/x-sentry-envelope" },
      body: envelope,
    })
    // The SDK backs off when Sentry says it's over its quota, so pass that on.
    const headers = new Headers()
    for (const name of RATE_LIMIT_HEADERS) {
      const value = upstream.headers.get(name)
      if (value !== null) headers.set(name, value)
    }
    return new Response(upstream.body, { status: upstream.status, headers })
  } catch {
    return new Response(null, { status: 502 })
  }
}
