// @vitest-environment node
import configPromise from "@payload-config"
import type { PayloadRequest, SanitizedConfig } from "payload"
import { beforeAll, describe, expect, it } from "vitest"

import { staffByDefault } from "../staffByDefault"

/** Payload's own collections and globals, added after plugins run. Members never reach them. */
const PAYLOAD_INTERNAL = /^payload-/

const member = { id: 1, collection: "users", roles: ["member"] }

/** Rules that let a logged-in user at their own documents, and nothing else. */
const OWN_DOCUMENTS = new Set([
  "articles.delete",
  "media.update",
  "media.delete",
  "map-assets.update",
  "map-assets.delete",
  "users.read",
  "users.update",
])

let config: SanitizedConfig
beforeAll(async () => {
  config = await configPromise
})

/** What an access rule answers for a request, with nothing else known. */
async function answer(rule: unknown, user: unknown): Promise<unknown> {
  if (typeof rule !== "function") return undefined
  const req = {
    user,
    payload: { config },
    headers: new Headers(),
    context: {},
  } as unknown as PayloadRequest
  return rule({ req, data: {}, id: undefined })
}

describe("staffByDefault", () => {
  it("fills only the rules a collection or global leaves out", () => {
    const own = () => true
    const result = staffByDefault({
      collections: [{ slug: "things", fields: [], access: { read: own, update: undefined } }],
      globals: [{ slug: "thing", fields: [] }],
    } as never) as unknown as SanitizedConfig

    const access = result.collections[0]!.access
    expect(access.read).toBe(own)
    for (const op of ["create", "update", "delete"] as const) {
      expect(typeof access[op]).toBe("function")
      expect(access[op]).not.toBe(own)
    }
    expect(Object.keys(result.globals[0]!.access)).toEqual(["read", "update"])
  })

  it("gives a logged-in member nothing an anonymous visitor doesn't have", async () => {
    const leaks: string[] = []
    const check = async (name: string, rules: Record<string, unknown>, ops: string[]) => {
      for (const op of ops) {
        const asMember = await answer(rules[op], member)
        const asNobody = await answer(rules[op], null)
        if (OWN_DOCUMENTS.has(`${name}.${op}`)) continue
        if (JSON.stringify(asMember) !== JSON.stringify(asNobody)) {
          leaks.push(`${name}.${op}: ${JSON.stringify(asMember)} vs ${JSON.stringify(asNobody)}`)
        }
      }
    }
    for (const { slug, access } of config.collections) {
      if (PAYLOAD_INTERNAL.test(slug)) continue
      await check(slug, access as Record<string, unknown>, ["create", "read", "update", "delete"])
    }
    for (const { slug, access } of config.globals) {
      if (PAYLOAD_INTERNAL.test(slug)) continue
      await check(slug, access as Record<string, unknown>, ["read", "update"])
    }
    expect(leaks).toEqual([])
  })
})
