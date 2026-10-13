import { MigrateUpArgs, MigrateDownArgs, sql } from "@payloadcms/db-postgres"

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "users" ADD COLUMN "destinygg_username" varchar;
  CREATE UNIQUE INDEX "users_destinygg_username_idx" ON "users" USING btree ("destinygg_username");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP INDEX "users_destinygg_username_idx";
  ALTER TABLE "users" DROP COLUMN "destinygg_username";`)
}
