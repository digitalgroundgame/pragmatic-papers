import { MigrateUpArgs, MigrateDownArgs, sql } from "@payloadcms/db-postgres"

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "docs" ADD COLUMN "tour" varchar;
  ALTER TABLE "_docs_v" ADD COLUMN "version_tour" varchar;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "docs" DROP COLUMN "tour";
  ALTER TABLE "_docs_v" DROP COLUMN "version_tour";`)
}
