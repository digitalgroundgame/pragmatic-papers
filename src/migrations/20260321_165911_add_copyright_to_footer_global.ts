import { MigrateUpArgs, MigrateDownArgs, sql } from "@payloadcms/db-postgres"

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_footer_copyright_type" AS ENUM('reference', 'custom');
  ALTER TABLE "footer" ADD COLUMN "copyright_type" "enum_footer_copyright_type" DEFAULT 'reference';
  ALTER TABLE "footer" ADD COLUMN "copyright_new_tab" boolean;
  ALTER TABLE "footer" ADD COLUMN "copyright_url" varchar;
  ALTER TABLE "footer" ADD COLUMN "copyright_label" varchar;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "footer" DROP COLUMN "copyright_type";
  ALTER TABLE "footer" DROP COLUMN "copyright_new_tab";
  ALTER TABLE "footer" DROP COLUMN "copyright_url";
  ALTER TABLE "footer" DROP COLUMN "copyright_label";
  DROP TYPE "public"."enum_footer_copyright_type";`)
}
