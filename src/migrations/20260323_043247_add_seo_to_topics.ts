import { MigrateUpArgs, MigrateDownArgs, sql } from "@payloadcms/db-postgres"

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "topics" ADD COLUMN "meta_title" varchar;
  ALTER TABLE "topics" ADD COLUMN "meta_image_id" integer;
  ALTER TABLE "topics" ADD COLUMN "meta_description" varchar;
  ALTER TABLE "topics" ADD CONSTRAINT "topics_meta_image_id_media_id_fk" FOREIGN KEY ("meta_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "topics_meta_meta_image_idx" ON "topics" USING btree ("meta_image_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "topics" DROP CONSTRAINT "topics_meta_image_id_media_id_fk";
  
  DROP INDEX "topics_meta_meta_image_idx";
  ALTER TABLE "topics" DROP COLUMN "meta_title";
  ALTER TABLE "topics" DROP COLUMN "meta_image_id";
  ALTER TABLE "topics" DROP COLUMN "meta_description";`)
}
