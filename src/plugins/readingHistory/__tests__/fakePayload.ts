import type { Payload } from "payload"
import { vi } from "vitest"

import { READS_SLUG } from "../constants"

type Row = Record<string, unknown> & { id: number }
type Where = Record<string, unknown>

/** Whether `doc` matches the few `where` shapes the plugin writes. */
function matches(doc: Record<string, unknown>, where: Where | undefined): boolean {
  if (!where) return true
  return Object.entries(where).every(([key, condition]) => {
    if (key === "and") return (condition as Where[]).every((part) => matches(doc, part))
    return String(doc[key]) === String((condition as { equals: unknown }).equals)
  })
}

function makeFake({
  users = [] as Row[],
  articles = [] as Row[],
  volumes = [] as Row[],
  reads = [] as Row[],
} = {}) {
  const store: Record<string, Row[]> = {
    users,
    articles,
    volumes,
    [READS_SLUG]: reads,
  }
  let nextId = 100
  const find = (collection: string, where?: Where) =>
    (store[collection] ?? []).filter((doc) => matches(doc, where))
  const payload = {
    logger: { debug: vi.fn(), error: vi.fn() },
    count: vi.fn(async ({ collection, where }: { collection: string; where?: Where }) => ({
      totalDocs: find(collection, where).length,
    })),
    find: vi.fn(async ({ collection, where }: { collection: string; where?: Where }) => ({
      docs: find(collection, where),
    })),
    create: vi.fn(async ({ collection, data }: { collection: string; data: Row }) => {
      const rows = store[collection]!
      if (
        collection === READS_SLUG &&
        rows.some((row) => row.user === data.user && row.article === data.article)
      ) {
        throw new Error("duplicate key value violates unique constraint")
      }
      const row = { ...data, id: nextId++ }
      rows.push(row)
      return row
    }),
    delete: vi.fn(async ({ collection, where }: { collection: string; where?: Where }) => {
      store[collection] = (store[collection] ?? []).filter((doc) => !matches(doc, where))
      return { docs: [] }
    }),
    db: {
      updateOne: vi.fn(
        async ({ collection, id, data }: { collection: string; id: number; data: Where }) => {
          const row = store[collection]!.find((doc) => doc.id === id)!
          Object.assign(row, data)
          return row
        },
      ),
    },
  }
  return { payload: payload as unknown as Payload & typeof payload, store }
}

type Fake = ReturnType<typeof makeFake>

/** A Payload that keeps users, articles, volumes and reads in memory. */
export const fakePayload = (rows: Parameters<typeof makeFake>[0] = {}): Fake => makeFake(rows)
