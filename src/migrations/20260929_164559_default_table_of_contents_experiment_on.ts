import { MigrateUpArgs, MigrateDownArgs, sql } from "@payloadcms/db-postgres"

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "site_settings" ALTER COLUMN "experiments_table_of_contents" SET DEFAULT true;`)
  // The Site Settings row already exists wherever the site has been saved, and
  // a new default doesn't reach it: switch the experiment on there too.
  await db.execute(sql`
   UPDATE "site_settings" SET "experiments_table_of_contents" = true;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "site_settings" ALTER COLUMN "experiments_table_of_contents" SET DEFAULT false;`)
}
