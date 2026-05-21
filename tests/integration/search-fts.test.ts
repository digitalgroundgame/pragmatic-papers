import { getPayloadConfig } from "@/utilities/getPayloadConfig"
import type { Payload } from "payload"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { sql } from "@payloadcms/db-postgres/drizzle"

// Shape of a row returned by the raw FTS query below
interface SearchResultRow {
  id: string | number
  body?: string
}

// Minimal interface for the Drizzle query executor exposed by Payload's DB adapter
interface DrizzleExecutor {
  execute: (query: ReturnType<typeof sql>) => Promise<{ rows: SearchResultRow[] }>
}

// The Payload DB adapter carries a `drizzle` property we need to run raw SQL.
// We cast to this interface because the public Payload type doesn't expose it.
interface DatabaseAdapterWithDrizzle {
  drizzle: DrizzleExecutor
}

describe("Full-Text Search Integration", () => {
  let payload: Payload

  beforeAll(async () => {
    payload = await getPayloadConfig()
  })

  afterAll(async () => {
    // Clean up the database connection so Testcontainers can shut down cleanly
    await payload.db.destroy?.()
  })

  it("truncates and indexes long body text for FTS searchability", async () => {
    // Unique keyword we will search for later — must not appear in other test data
    const keyword = "polyglotism"
    const articleTitle = "Extremely Long Article Test"

    // Create a published article whose Lexical content is one paragraph containing
    // the keyword repeated 10 000 times. This produces a body far larger than the
    // 39 000-character truncation limit, proving the hook truncates before indexing.
    const _article = await payload.create({
      collection: "articles",
      context: { disableRevalidate: true }, // skip ISR revalidation during tests
      data: {
        title: articleTitle,
        _status: "published",
        slug: "long-article-test",
        content: {
          root: {
            type: "root",
            format: "",
            indent: 0,
            version: 1,
            direction: "ltr",
            children: [
              {
                type: "paragraph",
                format: "",
                indent: 0,
                version: 1,
                direction: "ltr",
                children: [{ text: `${keyword} `.repeat(10000), type: "text", version: 1 }],
              },
            ],
          },
        },
      },
      overrideAccess: true,
    })

    // The `search` collection is a Payload global that mirrors searchable content.
    // After creating the article, a hook should have synced it into `search`.
    const { docs: searchDocs } = await payload.find({
      collection: "search",
      where: {
        slug: { equals: "long-article-test" },
      },
      overrideAccess: true,
    })

    expect(searchDocs.length).toBe(1)
    const searchDoc = searchDocs[0]!

    expect(searchDoc.body!.length).toBeLessThanOrEqual(39000)

    // Bypass Payload's query layer and hit Postgres directly. The `search_vector` tsvector
    // column is a native PostgreSQL column managed at the database level (via a schema hook in
    // src/plugins/searchVector.ts) and is not exposed to the standard Payload API.
    // Querying it directly using Drizzle's execute helper mirrors how the application executes
    // search queries in all environments, including production (see src/app/(frontend)/search/page.tsx).
    const db = (payload.db as unknown as DatabaseAdapterWithDrizzle).drizzle
    const ftsResult = await db.execute(sql`
      SELECT id 
      FROM search 
      WHERE search_vector @@ to_tsquery('english', ${keyword})
      AND id = ${searchDoc.id}
    `)

    expect(ftsResult.rows.length).toBe(1)
  })
})
