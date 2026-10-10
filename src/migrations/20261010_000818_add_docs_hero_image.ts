import { MigrateUpArgs, MigrateDownArgs, sql } from "@payloadcms/db-postgres"

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "docs" ADD COLUMN "hero_image_id" integer;
  ALTER TABLE "_docs_v" ADD COLUMN "version_hero_image_id" integer;
  ALTER TABLE "docs" ADD CONSTRAINT "docs_hero_image_id_media_id_fk" FOREIGN KEY ("hero_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_docs_v" ADD CONSTRAINT "_docs_v_version_hero_image_id_media_id_fk" FOREIGN KEY ("version_hero_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "docs_hero_image_idx" ON "docs" USING btree ("hero_image_id");
  CREATE INDEX "_docs_v_version_version_hero_image_idx" ON "_docs_v" USING btree ("version_hero_image_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "docs" DROP CONSTRAINT "docs_hero_image_id_media_id_fk";
  
  ALTER TABLE "_docs_v" DROP CONSTRAINT "_docs_v_version_hero_image_id_media_id_fk";
  
  DROP INDEX "docs_hero_image_idx";
  DROP INDEX "_docs_v_version_version_hero_image_idx";
  ALTER TABLE "docs" DROP COLUMN "hero_image_id";
  ALTER TABLE "_docs_v" DROP COLUMN "version_hero_image_id";`)
}
