import { MigrateUpArgs, MigrateDownArgs, sql } from "@payloadcms/db-postgres"

/**
 * Grants `author` to anyone already credited on an article who no longer holds
 * a byline role — the case the role exists for. Without this, a past
 * contributor who was dropped to `member` before the role existed stays
 * invisible: `readUsers` filters them out, so their byline and profile page
 * disappear from work they had already published.
 *
 * Deliberately a separate migration from `20260810_150000_add_author_role`:
 * Postgres refuses to use a newly added enum value in the transaction that
 * added it, and Payload runs each migration in its own transaction.
 */
export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   INSERT INTO "users_roles" ("order", "parent_id", "value")
  SELECT
    COALESCE((SELECT MAX(ur."order") FROM "users_roles" ur WHERE ur."parent_id" = u."id"), -1) + 1,
    u."id",
    'author'
  FROM "users" u
  WHERE EXISTS (
      SELECT 1 FROM "articles_rels" ar
      WHERE ar."users_id" = u."id" AND ar."path" = 'authors'
    )
    AND NOT EXISTS (
      SELECT 1 FROM "users_roles" ur
      WHERE ur."parent_id" = u."id"
        AND ur."value" IN ('chief-editor', 'editor', 'writer', 'narrator', 'author')
    );`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  // Cannot distinguish backfilled `author` rows from ones assigned by hand, so
  // this removes all of them.
  await db.execute(sql`
   DELETE FROM "users_roles" WHERE "value" = 'author';`)
}
