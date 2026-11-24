import { MigrateDownArgs, MigrateUpArgs, sql } from "@payloadcms/db-postgres"

/**
 * Unticks the hidden "generate slug" checkbox on every document and version that already has
 * a slug. While it's ticked, Payload's slugField rebuilds the slug from the title on every
 * update, publishing included, so a rename would move a live page to a new URL. Payload unticks
 * it once a document is published, but rows from before that (articles and pages from the old
 * `slug_lock` column, and the `DEFAULT true` columns added since) still have it ticked.
 *
 * Rows with no slug yet keep the box as it is, so Payload can still generate one.
 */
const TABLES = [
  "articles",
  "categories",
  "docs",
  "interactives",
  "pages",
  "topics",
  "users",
  "volumes",
] as const

const VERSION_TABLES = [
  "_articles_v",
  "_docs_v",
  "_interactives_v",
  "_pages_v",
  "_volumes_v",
] as const

export async function up({ db }: MigrateUpArgs): Promise<void> {
  for (const table of TABLES) {
    await db.execute(
      sql.raw(
        `UPDATE "${table}" SET "generate_slug" = false WHERE "generate_slug" AND COALESCE("slug", '') <> ''`,
      ),
    )
  }
  for (const table of VERSION_TABLES) {
    await db.execute(
      sql.raw(
        `UPDATE "${table}" SET "version_generate_slug" = false WHERE "version_generate_slug" AND COALESCE("version_slug", '') <> ''`,
      ),
    )
  }
}

/** Which rows were ticked before isn't kept, so there's nothing to put back. */
export async function down(_args: MigrateDownArgs): Promise<void> {}
