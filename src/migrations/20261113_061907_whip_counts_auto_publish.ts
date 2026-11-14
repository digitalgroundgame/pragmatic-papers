import { MigrateUpArgs, MigrateDownArgs, sql } from "@payloadcms/db-postgres"

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "whip_counts" ADD COLUMN "auto_publish" boolean DEFAULT false;
  ALTER TABLE "_whip_counts_v" ADD COLUMN "version_auto_publish" boolean DEFAULT false;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "whip_counts" DROP COLUMN "auto_publish";
  ALTER TABLE "_whip_counts_v" DROP COLUMN "version_auto_publish";`)
}
