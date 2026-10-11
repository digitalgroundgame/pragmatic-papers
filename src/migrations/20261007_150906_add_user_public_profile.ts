import { MigrateUpArgs, MigrateDownArgs, sql } from "@payloadcms/db-postgres"

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "users" ADD COLUMN "public_profile" boolean DEFAULT false;`)

  // Backfill everyone a byline already credits: an article's authors (its current
  // document, plus its newest published version, which is what readers see when a
  // newer draft has dropped them) and a narration's narrator.
  await db.execute(sql`
   UPDATE "users" SET "public_profile" = true WHERE "id" IN (
     SELECT "users_id" FROM "articles_rels" WHERE "path" = 'authors' AND "users_id" IS NOT NULL
     UNION
     SELECT r."users_id" FROM "_articles_v_rels" r
       JOIN (
         SELECT DISTINCT ON ("parent_id") "id" FROM "_articles_v"
         WHERE "version__status" = 'published'
         ORDER BY "parent_id", "updated_at" DESC
       ) published ON published."id" = r."parent_id"
       WHERE r."path" = 'version.authors' AND r."users_id" IS NOT NULL
     UNION
     SELECT "narrator_id" FROM "media" WHERE "narrator_id" IS NOT NULL
   );`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "users" DROP COLUMN "public_profile";`)
}
