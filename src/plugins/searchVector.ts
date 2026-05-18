import type { PostgresAdapterArgs } from "@payloadcms/db-postgres"
import { sql } from "@payloadcms/db-postgres/drizzle"
import { customType, index } from "@payloadcms/db-postgres/drizzle/pg-core"

type SchemaHook = NonNullable<PostgresAdapterArgs["afterSchemaInit"]>[number]

// tsvector isn't a built-in Drizzle pg type; declare it as a custom column so
// push sees the column exists. Postgres maintains the generated value, so we
// never read/write it through Drizzle and no map fns are needed.
const tsvector = customType<{ data: string; driverData: string }>({
  dataType() {
    return "tsvector"
  },
})

// Mirrors the DDL in 20260515_044418_add_search_plugin. Any drift between this
// expression and the migration may surface as a push warning at dev start.
const searchVectorExpression = sql`(
  setweight(to_tsvector('english', coalesce("title", '')),   'A') ||
  setweight(to_tsvector('english', coalesce("authors", '')), 'B') ||
  setweight(to_tsvector('english', coalesce("topics", '')),  'C') ||
  setweight(to_tsvector('english', coalesce("excerpt", '')), 'C') ||
  setweight(to_tsvector('english', coalesce("body", '')),    'D')
)`

export const searchVectorAfterSchemaInit: SchemaHook = ({ schema, extendTable }) => {
  const search = schema.tables.search
  if (!search) return schema

  extendTable({
    table: search,
    columns: {
      search_vector: tsvector("search_vector").generatedAlwaysAs(searchVectorExpression),
    },
    extraConfig: (t) => ({
      search_search_vector_idx: index("search_search_vector_idx").using("gin", t.search_vector),
    }),
  })

  return schema
}
