// @vitest-environment node
import { readFileSync } from "node:fs"
import { join } from "node:path"

import ts from "typescript"
import { describe, expect, it, vi } from "vitest"

import { type GatewayEnv, handleGatewayRequest, withGatewayTiming } from "../gateway"

const W = "https://w.dev"

function sites() {
  const answer = () =>
    Promise.resolve(new Response("ok", { headers: { "Cache-Control": "public" } }))
  const env = { SITE: { fetch: vi.fn(answer) }, CACHED_SITE: { fetch: vi.fn(answer) } }
  return env satisfies GatewayEnv
}

describe("handleGatewayRequest", () => {
  it("sends what the edge cache may answer to CachedSite", async () => {
    const env = sites()
    const request = new Request(`${W}/articles/a`)
    await handleGatewayRequest(request, env)
    expect(env.CACHED_SITE.fetch).toHaveBeenCalledWith(request)
    expect(env.SITE.fetch).not.toHaveBeenCalled()
  })

  it("sends a save's revalidate-all to CachedSite, so its purge reaches that cache", async () => {
    const env = sites()
    await handleGatewayRequest(new Request(`${W}/next/revalidate-all`, { method: "POST" }), env)
    expect(env.CACHED_SITE.fetch).toHaveBeenCalledOnce()
  })

  it.each([
    ["a signed-in editor", { headers: { Cookie: "payload-token=abc" } }],
    ["a navigation", { headers: { RSC: "1" } }],
    ["a POST", { method: "POST" }],
  ])("sends %s to the site's default entrypoint", async (_, init) => {
    const env = sites()
    await handleGatewayRequest(new Request(`${W}/articles/a`, init), env)
    expect(env.SITE.fetch).toHaveBeenCalledOnce()
    expect(env.CACHED_SITE.fetch).not.toHaveBeenCalled()
  })

  it("keeps the site's headers and says how many requests its isolate has handled", async () => {
    const env = sites()
    const first = await handleGatewayRequest(new Request(`${W}/`), env)
    const second = await handleGatewayRequest(new Request(`${W}/`), env)
    expect(first.headers.get("Cache-Control")).toBe("public")
    const count = (response: Response) =>
      Number(/isolate request (\d+)/.exec(response.headers.get("Server-Timing") ?? "")?.[1])
    expect(count(second)).toBe(count(first) + 1)
  })

  it("passes a WebSocket's answer through untouched", async () => {
    const upgraded = { status: 101, headers: new Headers() } as Response
    const env = { SITE: { fetch: vi.fn(async () => upgraded) }, CACHED_SITE: sites().CACHED_SITE }
    const request = new Request(`${W}/`, { headers: { Upgrade: "websocket" } })
    expect(await handleGatewayRequest(request, env)).toBe(upgraded)
  })
})

describe("withGatewayTiming", () => {
  it("appends to the Server-Timing the site gave", () => {
    const response = new Response("ok", { headers: { "Server-Timing": "cached-site;dur=5" } })
    expect(withGatewayTiming(response, 1000, 1, 1042).headers.get("Server-Timing")).toBe(
      'cached-site;dur=5, gateway;dur=42;desc="isolate request 1"',
    )
  })
})

describe("gateway.wrangler.jsonc", () => {
  const read = (file: string) => {
    const path = join(process.cwd(), file)
    const { config, error } = ts.parseConfigFileTextToJson(path, readFileSync(path, "utf8"))
    if (error) throw new Error(ts.flattenDiagnosticMessageText(error.messageText, "\n"))
    return config
  }
  interface Worker {
    name: string
    services?: { binding: string; service: string; entrypoint?: string }[]
  }
  const site = read("wrangler.jsonc") as Worker & { env: { production: Worker } }
  const gateway = read("gateway.wrangler.jsonc") as Worker & { env: { production: Worker } }
  const pairs: [string, Worker, Worker][] = [
    ["staging", gateway, site],
    ["production", gateway.env.production, site.env.production],
  ]

  it.each(pairs)("binds %s's gateway to that site's two entrypoints", (_, gw, worker) => {
    expect(gw.services).toEqual([
      { binding: "SITE", service: worker.name },
      { binding: "CACHED_SITE", service: worker.name, entrypoint: "CachedSite" },
    ])
    expect(gw.name).toBe(`${worker.name}-gateway`)
  })
})
