/**
 * Errors from opening a connection that a second try can get past: the DNS lookup of the
 * database's host failed for now (`EAI_AGAIN`), or the server or its pooler refused, reset or
 * didn't answer the connection. They come from `pool.connect()`, before any query is sent,
 * so trying again can't run a query twice.
 */
const TRANSIENT_CONNECT_ERRORS = new Set(["EAI_AGAIN", "ECONNREFUSED", "ECONNRESET", "ETIMEDOUT"])

/** Waits before each retry, in ms. Three retries over under 2 s, then the error stands. */
export const CONNECT_RETRY_DELAYS = [250, 500, 1000]

interface Logger {
  warn: (obj: object, msg: string) => void
}

interface PoolClient {
  release: (err?: Error | boolean) => void
}

type ConnectCallback = (
  err: Error | undefined,
  client?: PoolClient,
  done?: (err?: Error | boolean) => void,
) => void

/**
 * The parts of a node-postgres `Pool` used here. Structural, because Payload's adapter
 * builds its pool from its own pinned `pg`, whose types differ from ours.
 */
interface PostgresPool {
  on: (event: "error", listener: (err: Error) => void) => unknown
  connect: unknown
}

function errorCode(err: unknown): string | undefined {
  const code = (err as { code?: unknown } | null)?.code
  return typeof code === "string" ? code : undefined
}

export function isTransientConnectError(err: unknown): boolean {
  const code = errorCode(err)
  return code !== undefined && TRANSIENT_CONNECT_ERRORS.has(code)
}

/**
 * Makes the pool ride out a blip in reaching the database instead of failing the request
 * that hit it.
 *
 * - **Opening a connection** is retried after a transient error ({@link CONNECT_RETRY_DELAYS}).
 *   A container's DNS resolver failing for a moment (`getaddrinfo EAI_AGAIN`) otherwise
 *   answered the page that asked with a 500. `pool.query()` checks out its client through
 *   `pool.connect(callback)` and transactions through `await pool.connect()`, so wrapping
 *   `connect` on this pool covers both. Any other error, or one that outlasts the retries,
 *   is passed on as before.
 * - **A connection the server closes while idle** (a restart, an `admin_shutdown`) makes
 *   node-postgres drop the client and emit `error` on the pool. Payload only listens on the
 *   one client it holds, so without a listener here the event is thrown as an uncaught
 *   exception. The pool opens a new connection on the next query, so a warning is all it
 *   needs.
 */
export function hardenPostgresPool(
  pool: PostgresPool,
  logger: Logger,
  delays: number[] = CONNECT_RETRY_DELAYS,
): void {
  pool.on("error", (err) => {
    logger.warn({ err }, "Postgres closed an idle connection")
  })

  const connect = (pool.connect as () => Promise<PoolClient>).bind(pool)

  const connectWithRetry = async (): Promise<PoolClient> => {
    for (let attempt = 0; ; attempt++) {
      try {
        return await connect()
      } catch (err) {
        const delay = delays[attempt]
        if (delay === undefined || !isTransientConnectError(err)) throw err
        logger.warn(
          { err, attempt: attempt + 1, retryInMs: delay },
          "Couldn't reach Postgres, retrying",
        )
        await new Promise((resolve) => setTimeout(resolve, delay))
      }
    }
  }

  function retryingConnect(): Promise<PoolClient>
  function retryingConnect(callback: ConnectCallback): void
  function retryingConnect(callback?: ConnectCallback): Promise<PoolClient> | void {
    const result = connectWithRetry()
    if (!callback) return result
    result.then(
      (client) => callback(undefined, client, (releaseErr) => client.release(releaseErr)),
      (err: Error) => callback(err, undefined, () => undefined),
    )
  }

  pool.connect = retryingConnect
}
