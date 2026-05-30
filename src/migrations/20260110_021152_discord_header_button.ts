import { MigrateUpArgs, MigrateDownArgs, sql } from "@payloadcms/db-postgres"

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_header_action_button_link_type" AS ENUM('reference', 'custom');
  ALTER TABLE "header" ADD COLUMN "action_button_enabled" boolean DEFAULT false NOT NULL;
  ALTER TABLE "header" ADD COLUMN "action_button_link_type" "enum_header_action_button_link_type" DEFAULT 'reference';
  ALTER TABLE "header" ADD COLUMN "action_button_link_new_tab" boolean;
  ALTER TABLE "header" ADD COLUMN "action_button_link_url" varchar;
  ALTER TABLE "header" ADD COLUMN "action_button_link_label" varchar;
  ALTER TABLE "header" ADD COLUMN "action_button_background_color" varchar;
  ALTER TABLE "header" ADD COLUMN "action_button_text_color" varchar;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "header" DROP COLUMN "action_button_enabled";
  ALTER TABLE "header" DROP COLUMN "action_button_link_type";
  ALTER TABLE "header" DROP COLUMN "action_button_link_new_tab";
  ALTER TABLE "header" DROP COLUMN "action_button_link_url";
  ALTER TABLE "header" DROP COLUMN "action_button_link_label";
  ALTER TABLE "header" DROP COLUMN "action_button_background_color";
  ALTER TABLE "header" DROP COLUMN "action_button_text_color";
  DROP TYPE "public"."enum_header_action_button_link_type";`)
}
