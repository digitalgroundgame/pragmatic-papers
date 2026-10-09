import { MigrateUpArgs, MigrateDownArgs, sql } from "@payloadcms/db-postgres"

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "docs" ADD COLUMN "show_table_of_contents" boolean DEFAULT true;
  ALTER TABLE "_docs_v" ADD COLUMN "version_show_table_of_contents" boolean DEFAULT true;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "docs" DROP COLUMN "show_table_of_contents";
  ALTER TABLE "_docs_v" DROP COLUMN "version_show_table_of_contents";`)
}
