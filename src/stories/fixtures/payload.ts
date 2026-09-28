import type { Payload } from "payload"

interface Doc {
  id: number | string
}
type Where = Record<string, { equals?: unknown; in?: unknown[] } | undefined>

export interface FakePayloadData {
  collections?: Record<string, Doc[]>
  globals?: Record<string, Record<string, unknown>>
}

function matches(doc: Doc, where: Where | undefined): boolean {
  if (!where) return true
  return Object.entries(where).every(([field, condition]) => {
    if (!condition || typeof condition !== "object") return true
    const value = (doc as unknown as Record<string, unknown>)[field]
    if ("equals" in condition) return value === condition.equals
    if ("in" in condition && Array.isArray(condition.in)) return condition.in.includes(value)
    return true
  })
}

/**
 * The slice of the Local API that server components call, answered from
 * in-memory docs. `where` supports `equals` and `in`; other operators match
 * everything, so a story shows data rather than an empty state.
 */
export function createFakePayload({
  collections = {},
  globals = {},
}: FakePayloadData = {}): Payload {
  const fake = {
    async find(args: {
      collection: string
      where?: Where
      limit?: number
      page?: number
      pagination?: boolean
    }) {
      const all = (collections[args.collection] ?? []).filter((doc) => matches(doc, args.where))
      const limit = args.pagination === false ? all.length || 1 : (args.limit ?? 10)
      const page = args.page ?? 1
      const totalPages = Math.max(1, Math.ceil(all.length / limit))
      const docs = args.pagination === false ? all : all.slice((page - 1) * limit, page * limit)
      return {
        docs,
        totalDocs: all.length,
        limit,
        page,
        totalPages,
        pagingCounter: (page - 1) * limit + 1,
        hasPrevPage: page > 1,
        hasNextPage: page < totalPages,
        prevPage: page > 1 ? page - 1 : null,
        nextPage: page < totalPages ? page + 1 : null,
      }
    },
    async findByID(args: { collection: string; id: number | string }) {
      const doc = (collections[args.collection] ?? []).find((d) => d.id === args.id)
      if (!doc) throw new Error(`No ${args.collection} with id ${args.id} in the story fixtures`)
      return doc
    },
    async findGlobal(args: { slug: string }) {
      return globals[args.slug] ?? {}
    },
    async count(args: { collection: string; where?: Where }) {
      const all = (collections[args.collection] ?? []).filter((doc) => matches(doc, args.where))
      return { totalDocs: all.length }
    },
    async update() {
      return {}
    },
    logger: console,
  }
  return fake as unknown as Payload
}
