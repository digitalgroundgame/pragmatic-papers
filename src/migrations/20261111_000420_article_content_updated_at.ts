import { MigrateUpArgs, MigrateDownArgs, sql } from "@payloadcms/db-postgres"

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "articles" ADD COLUMN "content_updated_at" timestamp(3) with time zone;
  ALTER TABLE "_articles_v" ADD COLUMN "version_content_updated_at" timestamp(3) with time zone;`)

  // Published articles keep the "Updated" time readers see today.
  await db.execute(sql`
   UPDATE "articles" SET "content_updated_at" = "updated_at" WHERE "_status" = 'published';
  UPDATE "_articles_v" SET "version_content_updated_at" = "version_updated_at" WHERE "version__status" = 'published';`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "articles" DROP COLUMN "content_updated_at";
  ALTER TABLE "_articles_v" DROP COLUMN "version_content_updated_at";`)
}
