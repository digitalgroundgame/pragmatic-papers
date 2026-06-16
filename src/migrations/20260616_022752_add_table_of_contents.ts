import { MigrateUpArgs, MigrateDownArgs, sql } from "@payloadcms/db-postgres"

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "articles" ADD COLUMN "show_table_of_contents" boolean DEFAULT false;
  ALTER TABLE "_articles_v" ADD COLUMN "version_show_table_of_contents" boolean DEFAULT false;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "articles" DROP COLUMN "show_table_of_contents";
  ALTER TABLE "_articles_v" DROP COLUMN "version_show_table_of_contents";`)
}
