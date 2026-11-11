import { MigrateUpArgs, MigrateDownArgs, sql } from "@payloadcms/db-postgres"

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "users" ADD COLUMN "first_commented_at" timestamp(3) with time zone;`)
  // Each commenter's earliest published comment, which the comments plugin keeps from now on.
  await db.execute(sql`
   UPDATE "users" SET "first_commented_at" = "first"."created_at"
   FROM (
     SELECT "author_id", min("created_at") AS "created_at" FROM "comments"
     WHERE "status" = 'published' AND "author_id" IS NOT NULL
     GROUP BY "author_id"
   ) AS "first"
   WHERE "users"."id" = "first"."author_id";`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "users" DROP COLUMN "first_commented_at";`)
}
