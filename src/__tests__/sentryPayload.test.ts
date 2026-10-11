// @vitest-environment node
import { createRequire } from "node:module"
import { Writable } from "node:stream"

import * as Sentry from "@sentry/nextjs"
import {
  APIError,
  type AfterErrorHook,
  type Config,
  Forbidden,
  logError,
  NotFound,
  type Payload,
  QueryError,
  ValidationError,
} from "payload"
import { beforeAll, beforeEach, describe, expect, it } from "vitest"

import { clientIp, sentryPayloadPlugin, skipPluginErrorsInPino } from "../sentryPayload"

// Payload's own pino, which isn't a dependency of ours.
const pino = createRequire(import.meta.resolve("payload"))("pino") as (
  options: object,
  stream: Writable,
) => Payload["logger"]

const events: Sentry.ErrorEvent[] = []

beforeAll(() => {
  Sentry.init({
    dsn: "https://key@o0.ingest.sentry.io/1",
    defaultIntegrations: false,
    integrations: [Sentry.pinoIntegration({ error: { levels: ["error", "fatal"] } })],
    beforeSend: (event) => {
      events.push(event)
      return null
    },
  })
})

beforeEach(() => {
  events.length = 0
})

const config = sentryPayloadPlugin({
  admin: { components: { providers: ["@/providers/MathJaxProvider#MathJaxProviderRoot"] } },
  hooks: { afterLogout: [] },
} as unknown as Config) as Config

const logger = pino(
  { level: "info", hooks: { logMethod: skipPluginErrorsInPino } },
  new Writable({ write: (_chunk, _encoding, done) => done() }),
)
const payload = {
  logger,
  config: {
    // Payload's defaults (`sanitizeConfig`).
    loggingLevels: {
      Forbidden: "info",
      Locked: "info",
      MissingFile: "info",
      NotFound: "info",
      ValidationError: "info",
    },
  },
} as unknown as Payload
const user = { id: 7, collection: "users", email: "writer@example.com" }

/** What Payload's `routeError` does with an error: log it, then run `afterError`. */
async function routeError(error: Error): Promise<void> {
  logError({ err: error, payload })
  for (const hook of config.hooks?.afterError ?? []) {
    await (hook as AfterErrorHook)({
      collection: { slug: "articles" },
      context: {},
      error,
      req: {
        headers: new Headers({ "X-Forwarded-For": "203.0.113.5, 172.70.1.1" }),
        payload,
        user,
      },
      result: {},
    } as unknown as Parameters<AfterErrorHook>[0])
  }
  await Sentry.flush()
}

describe("sentryPayloadPlugin", () => {
  it("keeps our admin providers and other hooks, with ours in place of the plugin's", () => {
    expect(config.admin?.components?.providers).toEqual([
      "@/providers/MathJaxProvider#MathJaxProviderRoot",
      "@/providers/AdminSentryProvider#AdminSentryProvider",
    ])
    expect(Object.keys(config.hooks ?? {}).sort()).toEqual(["afterError", "afterLogout"])
  })
})

describe("clientIp", () => {
  it("takes the client from a proxy chain, and nothing from an empty header", () => {
    expect(clientIp("203.0.113.5, 172.70.1.1, 10.0.0.2")).toBe("203.0.113.5")
    expect(clientIp("2001:db8::1")).toBe("2001:db8::1")
    expect(clientIp("")).toBeUndefined()
    expect(clientIp(null)).toBeUndefined()
  })
})

describe("Payload errors in Sentry", () => {
  it("reports a QueryError once, from the log line", async () => {
    await routeError(new QueryError([{ path: "roles" }]))

    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({
      logger: "pino",
      exception: { values: [{ type: "QueryError" }] },
    })
  })

  it.each([
    ["an APIError", new APIError("Something broke", 500)],
    ["an error with no status", new TypeError("Cannot read properties of undefined")],
  ])("reports %s once, with the user", async (_name, error) => {
    await routeError(error)

    expect(events).toHaveLength(1)
    expect(events[0]?.logger).toBeUndefined()
    expect(events[0]?.user).toMatchObject({
      id: 7,
      email: "writer@example.com",
      ip_address: "203.0.113.5",
    })
  })

  it.each([
    ["ValidationError", new ValidationError({ errors: [{ message: "Required", path: "title" }] })],
    ["Forbidden", new Forbidden()],
    ["NotFound", new NotFound()],
  ])("doesn't report a %s", async (_name, error) => {
    await routeError(error)

    expect(events).toHaveLength(0)
  })

  it("reports an error-level line of our own, and a recovered failure Payload logs", async () => {
    logger.error({ err: new Error("Sync failed") }, "Shopify sync failed")
    logger.error({
      err: new QueryError([{ path: "roles" }]),
      msg: "Error validating filter options for collection users",
    })
    await Sentry.flush()

    expect(events.map((event) => event.exception?.values?.[0]?.type)).toEqual([
      "Error",
      "QueryError",
    ])
  })
})
