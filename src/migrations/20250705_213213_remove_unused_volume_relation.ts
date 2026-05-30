/* eslint-disable @typescript-eslint/no-unused-vars */
import { type MigrateUpArgs, type MigrateDownArgs, sql } from "@payloadcms/db-postgres"

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "articles" DROP CONSTRAINT "articles_volume_id_volumes_id_fk";

  ALTER TABLE "_articles_v" DROP CONSTRAINT "_articles_v_version_volume_id_volumes_id_fk";

  DROP INDEX "articles_volume_idx";
  DROP INDEX "_articles_v_version_version_volume_idx";
  ALTER TABLE "articles" DROP COLUMN "volume_id";
  ALTER TABLE "_articles_v" DROP COLUMN "version_volume_id";`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "articles" ADD COLUMN "volume_id" integer;
  ALTER TABLE "_articles_v" ADD COLUMN "version_volume_id" integer;
  ALTER TABLE "articles" ADD CONSTRAINT "articles_volume_id_volumes_id_fk" FOREIGN KEY ("volume_id") REFERENCES "public"."volumes"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_articles_v" ADD CONSTRAINT "_articles_v_version_volume_id_volumes_id_fk" FOREIGN KEY ("version_volume_id") REFERENCES "public"."volumes"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "articles_volume_idx" ON "articles" USING btree ("volume_id");
  CREATE INDEX "_articles_v_version_version_volume_idx" ON "_articles_v" USING btree ("version_volume_id");`)
}
