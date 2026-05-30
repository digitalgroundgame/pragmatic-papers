import { MigrateUpArgs, MigrateDownArgs, sql } from "@payloadcms/db-postgres"

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_header_action_button_variant" AS ENUM('default', 'outline', 'ghost', 'link');
  ALTER TABLE "header_nav_items" ALTER COLUMN "link_label" DROP NOT NULL;
  ALTER TABLE "header" ALTER COLUMN "action_button_enabled" DROP NOT NULL;
  ALTER TABLE "footer_nav_items" ALTER COLUMN "link_label" DROP NOT NULL;
  ALTER TABLE "header" ADD COLUMN "action_button_variant" "enum_header_action_button_variant" DEFAULT 'default';
  ALTER TABLE "articles_footnotes" DROP COLUMN "link_appearance";
  ALTER TABLE "_articles_v_version_footnotes" DROP COLUMN "link_appearance";
  DROP TYPE "public"."enum_articles_footnotes_link_appearance";
  DROP TYPE "public"."enum__articles_v_version_footnotes_link_appearance";`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_articles_footnotes_link_appearance" AS ENUM('default', 'outline');
  CREATE TYPE "public"."enum__articles_v_version_footnotes_link_appearance" AS ENUM('default', 'outline');
  ALTER TABLE "header_nav_items" ALTER COLUMN "link_label" SET NOT NULL;
  ALTER TABLE "header" ALTER COLUMN "action_button_enabled" SET NOT NULL;
  ALTER TABLE "footer_nav_items" ALTER COLUMN "link_label" SET NOT NULL;
  ALTER TABLE "articles_footnotes" ADD COLUMN "link_appearance" "enum_articles_footnotes_link_appearance" DEFAULT 'default';
  ALTER TABLE "_articles_v_version_footnotes" ADD COLUMN "link_appearance" "enum__articles_v_version_footnotes_link_appearance" DEFAULT 'default';
  ALTER TABLE "header" DROP COLUMN "action_button_variant";
  DROP TYPE "public"."enum_header_action_button_variant";`)
}
