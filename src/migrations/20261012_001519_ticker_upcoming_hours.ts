import { MigrateUpArgs, MigrateDownArgs, sql } from "@payloadcms/db-postgres"

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "header" ADD COLUMN "ticker_upcoming_hours" numeric DEFAULT 24;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "header" DROP COLUMN "ticker_upcoming_hours";`)
}
