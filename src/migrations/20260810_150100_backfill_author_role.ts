import { MigrateUpArgs, MigrateDownArgs, sql } from "@payloadcms/db-postgres"

/**
 * Establishes the invariant `ensureAuthorRole` maintains from here on: every
 * contributor carries `author`, so stepping down is just dropping the
 * contributor role.
 *
 * Grants `author` to two groups:
 *  1. Everyone currently holding a contributor role, so the invariant holds for
 *     existing users the hook never ran for.
 *  2. Anyone already credited on an article who holds no contributor role —
 *     contributors demoted before this role existed. Without this they stay
 *     invisible to `readUsers`, and their byline and profile page vanish from
 *     work they had already published.
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
  WHERE NOT EXISTS (
      SELECT 1 FROM "users_roles" ur
      WHERE ur."parent_id" = u."id" AND ur."value" = 'author'
    )
    AND (
      EXISTS (
        SELECT 1 FROM "users_roles" ur
        WHERE ur."parent_id" = u."id"
          AND ur."value" IN ('chief-editor', 'editor', 'writer', 'narrator')
      )
      OR EXISTS (
        SELECT 1 FROM "articles_rels" ar
        WHERE ar."users_id" = u."id" AND ar."path" = 'authors'
      )
    );`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  // Cannot distinguish backfilled `author` rows from ones assigned by hand, so
  // this removes all of them.
  await db.execute(sql`
   DELETE FROM "users_roles" WHERE "value" = 'author';`)
}
