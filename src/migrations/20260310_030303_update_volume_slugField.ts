import { MigrateUpArgs, MigrateDownArgs, sql } from "@payloadcms/db-postgres"

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "volumes" RENAME COLUMN "slug_lock" TO "generate_slug";
  ALTER TABLE "_volumes_v" RENAME COLUMN "version_slug_lock" TO "version_generate_slug";
  DROP INDEX "volumes_slug_idx";
  CREATE UNIQUE INDEX "volumes_slug_idx" ON "volumes" USING btree ("slug");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "volumes" RENAME COLUMN "generate_slug" TO "slug_lock";
  ALTER TABLE "_volumes_v" RENAME COLUMN "version_generate_slug" TO "version_slug_lock";
  DROP INDEX "volumes_slug_idx";
  CREATE INDEX "volumes_slug_idx" ON "volumes" USING btree ("slug");`)
}
