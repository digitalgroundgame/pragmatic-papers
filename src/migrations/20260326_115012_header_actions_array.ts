import { MigrateUpArgs, MigrateDownArgs, sql } from "@payloadcms/db-postgres"

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_articles_footnotes_link_variant" AS ENUM('link', 'default', 'outline', 'ghost', 'branded');
  CREATE TYPE "public"."enum_articles_populated_authors_socials_link_variant" AS ENUM('link', 'default', 'outline', 'ghost', 'branded');
  CREATE TYPE "public"."enum__articles_v_version_footnotes_link_variant" AS ENUM('link', 'default', 'outline', 'ghost', 'branded');
  CREATE TYPE "public"."enum__articles_v_version_populated_authors_socials_link_variant" AS ENUM('link', 'default', 'outline', 'ghost', 'branded');
  CREATE TYPE "public"."enum_users_socials_link_variant" AS ENUM('link', 'default', 'outline', 'ghost', 'branded');
  CREATE TYPE "public"."enum_header_nav_items_link_variant" AS ENUM('link', 'default', 'outline', 'ghost', 'branded');
  CREATE TYPE "public"."enum_header_actions_link_type" AS ENUM('reference', 'custom');
  CREATE TYPE "public"."enum_header_actions_link_variant" AS ENUM('link', 'default', 'outline', 'ghost', 'branded');
  CREATE TYPE "public"."enum_footer_nav_items_link_variant" AS ENUM('link', 'default', 'outline', 'ghost', 'branded');
  CREATE TYPE "public"."enum_footer_socials_link_variant" AS ENUM('link', 'default', 'outline', 'ghost', 'branded');
  CREATE TYPE "public"."enum_footer_copyright_variant" AS ENUM('link', 'default', 'outline', 'ghost', 'branded');
  CREATE TABLE "header_actions" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"link_type" "enum_header_actions_link_type" DEFAULT 'reference',
  	"link_new_tab" boolean,
  	"link_variant" "enum_header_actions_link_variant" DEFAULT 'link',
  	"link_url" varchar,
  	"link_label" varchar
  );
  
  ALTER TABLE "articles_footnotes" ADD COLUMN "link_variant" "enum_articles_footnotes_link_variant" DEFAULT 'link';
  ALTER TABLE "articles_populated_authors_socials" ADD COLUMN "link_variant" "enum_articles_populated_authors_socials_link_variant" DEFAULT 'link';
  ALTER TABLE "_articles_v_version_footnotes" ADD COLUMN "link_variant" "enum__articles_v_version_footnotes_link_variant" DEFAULT 'link';
  ALTER TABLE "_articles_v_version_populated_authors_socials" ADD COLUMN "link_variant" "enum__articles_v_version_populated_authors_socials_link_variant" DEFAULT 'link';
  ALTER TABLE "users_socials" ADD COLUMN "link_variant" "enum_users_socials_link_variant" DEFAULT 'link';
  ALTER TABLE "header_nav_items" ADD COLUMN "link_variant" "enum_header_nav_items_link_variant" DEFAULT 'link';
  ALTER TABLE "footer_nav_items" ADD COLUMN "link_variant" "enum_footer_nav_items_link_variant" DEFAULT 'link';
  ALTER TABLE "footer_socials" ADD COLUMN "link_variant" "enum_footer_socials_link_variant" DEFAULT 'link';
  ALTER TABLE "footer" ADD COLUMN "copyright_variant" "enum_footer_copyright_variant" DEFAULT 'link';
  ALTER TABLE "header_actions" ADD CONSTRAINT "header_actions_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."header"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "header_actions_order_idx" ON "header_actions" USING btree ("_order");
  CREATE INDEX "header_actions_parent_id_idx" ON "header_actions" USING btree ("_parent_id");
  ALTER TABLE "header" DROP COLUMN "action_button_enabled";
  ALTER TABLE "header" DROP COLUMN "action_button_link_type";
  ALTER TABLE "header" DROP COLUMN "action_button_link_new_tab";
  ALTER TABLE "header" DROP COLUMN "action_button_link_url";
  ALTER TABLE "header" DROP COLUMN "action_button_link_label";
  ALTER TABLE "header" DROP COLUMN "action_button_background_color";
  ALTER TABLE "header" DROP COLUMN "action_button_text_color";
  ALTER TABLE "header" DROP COLUMN "action_button_variant";
  DROP TYPE "public"."enum_header_action_button_link_type";
  DROP TYPE "public"."enum_header_action_button_variant";`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_header_action_button_link_type" AS ENUM('reference', 'custom');
  CREATE TYPE "public"."enum_header_action_button_variant" AS ENUM('default', 'outline', 'ghost', 'link');
  DROP TABLE "header_actions" CASCADE;
  ALTER TABLE "header" ADD COLUMN "action_button_enabled" boolean DEFAULT false NOT NULL;
  ALTER TABLE "header" ADD COLUMN "action_button_link_type" "enum_header_action_button_link_type" DEFAULT 'reference';
  ALTER TABLE "header" ADD COLUMN "action_button_link_new_tab" boolean;
  ALTER TABLE "header" ADD COLUMN "action_button_link_url" varchar;
  ALTER TABLE "header" ADD COLUMN "action_button_link_label" varchar;
  ALTER TABLE "header" ADD COLUMN "action_button_background_color" varchar;
  ALTER TABLE "header" ADD COLUMN "action_button_text_color" varchar;
  ALTER TABLE "header" ADD COLUMN "action_button_variant" "enum_header_action_button_variant" DEFAULT 'default';
  ALTER TABLE "articles_footnotes" DROP COLUMN "link_variant";
  ALTER TABLE "articles_populated_authors_socials" DROP COLUMN "link_variant";
  ALTER TABLE "_articles_v_version_footnotes" DROP COLUMN "link_variant";
  ALTER TABLE "_articles_v_version_populated_authors_socials" DROP COLUMN "link_variant";
  ALTER TABLE "users_socials" DROP COLUMN "link_variant";
  ALTER TABLE "header_nav_items" DROP COLUMN "link_variant";
  ALTER TABLE "footer_nav_items" DROP COLUMN "link_variant";
  ALTER TABLE "footer_socials" DROP COLUMN "link_variant";
  ALTER TABLE "footer" DROP COLUMN "copyright_variant";
  DROP TYPE "public"."enum_articles_footnotes_link_variant";
  DROP TYPE "public"."enum_articles_populated_authors_socials_link_variant";
  DROP TYPE "public"."enum__articles_v_version_footnotes_link_variant";
  DROP TYPE "public"."enum__articles_v_version_populated_authors_socials_link_variant";
  DROP TYPE "public"."enum_users_socials_link_variant";
  DROP TYPE "public"."enum_header_nav_items_link_variant";
  DROP TYPE "public"."enum_header_actions_link_type";
  DROP TYPE "public"."enum_header_actions_link_variant";
  DROP TYPE "public"."enum_footer_nav_items_link_variant";
  DROP TYPE "public"."enum_footer_socials_link_variant";
  DROP TYPE "public"."enum_footer_copyright_variant";`)
}
