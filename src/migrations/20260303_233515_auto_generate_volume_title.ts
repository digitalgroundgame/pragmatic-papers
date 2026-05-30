import { MigrateDownArgs, MigrateUpArgs, sql } from "@payloadcms/db-postgres"

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "volumes" ADD COLUMN "auto_generate_title" boolean DEFAULT true;
  ALTER TABLE "_volumes_v" ADD COLUMN "version_auto_generate_title" boolean DEFAULT true;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "volumes" DROP COLUMN "auto_generate_title";
  ALTER TABLE "_volumes_v" DROP COLUMN "version_auto_generate_title";`)
}
