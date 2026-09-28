import { MigrateUpArgs, MigrateDownArgs, sql } from "@payloadcms/db-postgres"

// IF NOT EXISTS: PR #748's preview database kept its copy of these columns from this
// migration's earlier name (20260928_105503), and would otherwise fail to redeploy.
export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "articles" ADD COLUMN IF NOT EXISTS "show_table_of_contents" boolean DEFAULT false;
  ALTER TABLE "_articles_v" ADD COLUMN IF NOT EXISTS "version_show_table_of_contents" boolean DEFAULT false;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "articles" DROP COLUMN "show_table_of_contents";
  ALTER TABLE "_articles_v" DROP COLUMN "version_show_table_of_contents";`)
}
