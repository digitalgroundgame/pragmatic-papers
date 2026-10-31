import type { Payload } from "payload"
import { vi } from "vitest"

import { ACHIEVEMENTS_SLUG, AWARDS_SLUG } from "../constants"

type Row = Record<string, unknown> & { id: number }
type Where = Record<string, unknown>

/** Whether `doc` matches the few `where` shapes the plugin writes. */
function matches(doc: Record<string, unknown>, where: Where | undefined): boolean {
  if (!where) return true
  return Object.entries(where).every(([key, condition]) => {
    if (key === "and") return (condition as Where[]).every((part) => matches(doc, part))
    const value = String(doc[key])
    const { equals, in: within, not_in, not_equals } = condition as Record<string, unknown>
    if (equals !== undefined) return value === String(equals)
    if (within !== undefined) return (within as unknown[]).map(String).includes(value)
    if (not_in !== undefined) return !(not_in as unknown[]).map(String).includes(value)
    if (not_equals !== undefined) return value !== String(not_equals)
    return true
  })
}

/** Verified and Early member (first two members), as a site starts with them. */
export const starter = (): Row[] => [
  { id: 1, name: "Early member", rule: "firstMembers", limit: 2, badge: true, _order: "a1" },
  { id: 2, name: "Verified", rule: "verified", badge: true, _order: "a2" },
]

function makeFake({ users = [] as Row[], rows = [] as Row[], achievements = starter() } = {}) {
  const store: Record<string, Row[]> = {
    users,
    [AWARDS_SLUG]: rows,
    [ACHIEVEMENTS_SLUG]: achievements,
  }
  const kv = new Map<string, unknown>()
  let nextId = 1000
  const payload = {
    logger: { info: vi.fn(), error: vi.fn() },
    kv: {
      has: async (key: string) => kv.has(key),
      set: async (key: string, value: unknown) => void kv.set(key, value),
    },
    find: vi.fn(
      async ({
        collection,
        where,
        sort,
        limit = 10,
        page = 1,
        pagination = true,
      }: {
        collection: string
        where?: Where
        sort?: string
        limit?: number
        page?: number
        pagination?: boolean
      }) => {
        let docs = (store[collection] ?? []).filter((doc) => matches(doc, where))
        if (sort) {
          docs = [...docs].sort((a, b) => String(a[sort]).localeCompare(String(b[sort])))
        }
        if (!pagination) return { docs, hasNextPage: false }
        const start = (page - 1) * limit
        return { docs: docs.slice(start, start + limit), hasNextPage: docs.length > start + limit }
      },
    ),
    findByID: vi.fn(
      async ({ collection, id }: { collection: string; id: unknown }) =>
        (store[collection] ?? []).find((doc) => String(doc.id) === String(id)) ?? null,
    ),
    count: vi.fn(async ({ collection, where }: { collection: string; where?: Where }) => ({
      totalDocs: (store[collection] ?? []).filter((doc) => matches(doc, where)).length,
    })),
    create: vi.fn(async ({ collection, data }: { collection: string; data: Row }) => {
      const doc = { ...data, id: nextId++ }
      store[collection] = [...(store[collection] ?? []), doc]
      return doc
    }),
    delete: vi.fn(async ({ collection, where }: { collection: string; where?: Where }) => {
      store[collection] = (store[collection] ?? []).filter((doc) => !matches(doc, where))
    }),
    update: vi.fn(
      async ({ collection, where, data }: { collection: string; where?: Where; data: Row }) => {
        store[collection] = (store[collection] ?? []).map((doc) =>
          matches(doc, where) ? { ...doc, ...data } : doc,
        )
      },
    ),
  }
  return { payload: payload as unknown as Payload & typeof payload, store, kv }
}

/**
 * An in-memory Payload holding users, achievements (Verified and Early member unless given)
 * and awards, for the plugin's own queries.
 */
export function fakePayload(
  seed: Parameters<typeof makeFake>[0] = {},
): ReturnType<typeof makeFake> {
  return makeFake(seed)
}
