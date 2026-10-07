import { EventEmitter } from "node:events"
import { Pool } from "pg"
import { afterEach, describe, expect, it, vi } from "vitest"

import { hardenPostgresPool, isTransientConnectError } from "../postgresPool"

function codedError(code: string, message = `getaddrinfo ${code} db.example.org`) {
  return Object.assign(new Error(message), { code })
}

/** Fails to connect with each of `failures` in turn, then connects and answers every query. */
function fakeClient(failures: Error[]) {
  const attempts = { count: 0 }
  class FakeClient extends EventEmitter {
    connect(callback: (err?: Error) => void) {
      const failure = failures[attempts.count++]
      setImmediate(() => callback(failure))
    }
    query(_text: string, _values: unknown, callback: (err: Error | null, res: unknown) => void) {
      setImmediate(() => callback(null, { rows: [{ ok: true }] }))
    }
    end(callback?: () => void) {
      callback?.()
    }
  }
  return { FakeClient, attempts }
}

function hardenedPool(failures: Error[], delays = [0, 0, 0]) {
  const { FakeClient, attempts } = fakeClient(failures)
  const pool = new Pool({ Client: FakeClient as never })
  const logger = { warn: vi.fn() }
  hardenPostgresPool(pool, logger, delays)
  return { pool, logger, attempts }
}

describe("isTransientConnectError", () => {
  it("matches a failed DNS lookup and refused, reset or timed-out connections", () => {
    for (const code of ["EAI_AGAIN", "ECONNREFUSED", "ECONNRESET", "ETIMEDOUT"]) {
      expect(isTransientConnectError(codedError(code))).toBe(true)
    }
  })

  it("leaves a host that doesn't exist, a Postgres error and a plain error alone", () => {
    expect(isTransientConnectError(codedError("ENOTFOUND"))).toBe(false)
    // 28P01: invalid_password, which no retry fixes.
    expect(isTransientConnectError(codedError("28P01", "password authentication failed"))).toBe(
      false,
    )
    expect(isTransientConnectError(new Error("boom"))).toBe(false)
    expect(isTransientConnectError(undefined)).toBe(false)
  })
})

describe("hardenPostgresPool", () => {
  let pools: Pool[] = []
  afterEach(async () => {
    await Promise.all(pools.map((pool) => pool.end()))
    pools = []
  })
  const track = <T extends { pool: Pool }>(result: T) => {
    pools.push(result.pool)
    return result
  }

  it("retries a query whose connection failed on a DNS blip", async () => {
    const { pool, logger, attempts } = track(
      hardenedPool([codedError("EAI_AGAIN"), codedError("EAI_AGAIN")]),
    )

    await expect(pool.query("select 1")).resolves.toMatchObject({ rows: [{ ok: true }] })
    expect(attempts.count).toBe(3)
    expect(logger.warn).toHaveBeenCalledTimes(2)
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ attempt: 1 }),
      "Couldn't reach Postgres, retrying",
    )
  })

  it("retries a client checked out for a transaction", async () => {
    const { pool, attempts } = track(hardenedPool([codedError("ECONNRESET")]))

    const client = await pool.connect()
    expect(attempts.count).toBe(2)
    client.release()
  })

  it("passes the error on once the retries run out", async () => {
    const { pool, attempts } = track(
      hardenedPool(Array.from({ length: 4 }, () => codedError("EAI_AGAIN"))),
    )

    await expect(pool.query("select 1")).rejects.toMatchObject({ code: "EAI_AGAIN" })
    expect(attempts.count).toBe(4)
  })

  it("doesn't retry an error a second try can't fix", async () => {
    const { pool, logger, attempts } = track(
      hardenedPool([codedError("28P01", "password authentication failed")]),
    )

    await expect(pool.query("select 1")).rejects.toThrow("password authentication failed")
    expect(attempts.count).toBe(1)
    expect(logger.warn).not.toHaveBeenCalled()
  })

  it("logs a connection the server closed while idle instead of throwing it", () => {
    const { pool, logger } = track(hardenedPool([]))

    const err = new Error("terminating connection due to administrator command")
    expect(() => pool.emit("error", err)).not.toThrow()
    expect(logger.warn).toHaveBeenCalledWith({ err }, "Postgres closed an idle connection")
  })
})
