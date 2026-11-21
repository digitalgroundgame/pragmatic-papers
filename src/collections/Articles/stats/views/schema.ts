import type { PostgresAdapterArgs } from "@payloadcms/db-postgres"
import { date, index, integer, pgTable, primaryKey } from "@payloadcms/db-postgres/drizzle/pg-core"

type SchemaHook = NonNullable<PostgresAdapterArgs["afterSchemaInit"]>[number]

/** Our own count of each article's views: one row per article per day (UTC). */
export const ARTICLE_VIEWS_TABLE = "article_views"

/**
 * The views table, as a plain table beside Payload's rather than a collection: nothing in
 * the admin lists it, and a view is counted with one upsert (`recordView`), which Payload's
 * API can't do. It holds a number per article and day and nothing about the reader. Declared
 * here so dev's push leaves it alone and `payload migrate:create` writes its DDL.
 */
export const articleViewsAfterSchemaInit: SchemaHook = ({ schema }) => {
  const articles = schema.tables.articles
  if (!articles) return schema

  return {
    ...schema,
    tables: {
      ...schema.tables,
      [ARTICLE_VIEWS_TABLE]: pgTable(
        ARTICLE_VIEWS_TABLE,
        {
          article_id: integer("article_id")
            .notNull()
            .references(() => articles.id, { onDelete: "cascade" }),
          day: date("day", { mode: "string" }).notNull(),
          views: integer("views").notNull().default(0),
        },
        (t) => [
          primaryKey({ name: `${ARTICLE_VIEWS_TABLE}_pkey`, columns: [t.article_id, t.day] }),
          // The first day anything was counted, which says when counting began.
          index(`${ARTICLE_VIEWS_TABLE}_day_idx`).on(t.day),
        ],
      ),
    },
  }
}
