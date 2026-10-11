import { MigrateUpArgs, MigrateDownArgs, sql } from "@payloadcms/db-postgres"

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "site_settings" ADD COLUMN "experiments_docs" boolean DEFAULT false;
  ALTER TABLE "site_settings" ADD COLUMN "experiments_notifications" boolean DEFAULT false;
  ALTER TABLE "site_settings" ADD COLUMN "experiments_tours" boolean DEFAULT false;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "site_settings" DROP COLUMN "experiments_docs";
  ALTER TABLE "site_settings" DROP COLUMN "experiments_notifications";
  ALTER TABLE "site_settings" DROP COLUMN "experiments_tours";`)
}
