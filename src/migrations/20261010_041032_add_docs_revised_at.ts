import { MigrateUpArgs, MigrateDownArgs, sql } from "@payloadcms/db-postgres"

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "docs" ADD COLUMN "revised_at" timestamp(3) with time zone;
  ALTER TABLE "_docs_v" ADD COLUMN "version_revised_at" timestamp(3) with time zone;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "docs" DROP COLUMN "revised_at";
  ALTER TABLE "_docs_v" DROP COLUMN "version_revised_at";`)
}
