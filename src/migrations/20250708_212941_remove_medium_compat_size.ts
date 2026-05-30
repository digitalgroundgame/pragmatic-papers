/* eslint-disable @typescript-eslint/no-unused-vars */
import { type MigrateUpArgs, type MigrateDownArgs, sql } from "@payloadcms/db-postgres"

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   DROP INDEX "media_sizes_medium_compat_sizes_medium_compat_filename_idx";
  ALTER TABLE "media" DROP COLUMN "sizes_medium_compat_url";
  ALTER TABLE "media" DROP COLUMN "sizes_medium_compat_width";
  ALTER TABLE "media" DROP COLUMN "sizes_medium_compat_height";
  ALTER TABLE "media" DROP COLUMN "sizes_medium_compat_mime_type";
  ALTER TABLE "media" DROP COLUMN "sizes_medium_compat_filesize";
  ALTER TABLE "media" DROP COLUMN "sizes_medium_compat_filename";`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "media" ADD COLUMN "sizes_medium_compat_url" varchar;
  ALTER TABLE "media" ADD COLUMN "sizes_medium_compat_width" numeric;
  ALTER TABLE "media" ADD COLUMN "sizes_medium_compat_height" numeric;
  ALTER TABLE "media" ADD COLUMN "sizes_medium_compat_mime_type" varchar;
  ALTER TABLE "media" ADD COLUMN "sizes_medium_compat_filesize" numeric;
  ALTER TABLE "media" ADD COLUMN "sizes_medium_compat_filename" varchar;
  CREATE INDEX "media_sizes_medium_compat_sizes_medium_compat_filename_idx" ON "media" USING btree ("sizes_medium_compat_filename");`)
}
