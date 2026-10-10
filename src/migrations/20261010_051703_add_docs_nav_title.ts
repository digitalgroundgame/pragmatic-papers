import { MigrateUpArgs, MigrateDownArgs, sql } from "@payloadcms/db-postgres"

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "docs" ADD COLUMN "nav_title" varchar;
  ALTER TABLE "_docs_v" ADD COLUMN "version_nav_title" varchar;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "docs" DROP COLUMN "nav_title";
  ALTER TABLE "_docs_v" DROP COLUMN "version_nav_title";`)
}
