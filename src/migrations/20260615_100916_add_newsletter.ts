import { MigrateUpArgs, MigrateDownArgs, sql } from "@payloadcms/db-postgres"

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_pages_blocks_content_width" AS ENUM('narrow', 'wide', 'full');
  CREATE TYPE "public"."enum__pages_v_blocks_content_width" AS ENUM('narrow', 'wide', 'full');
  CREATE TYPE "public"."enum_footer_blocks_content_columns_size" AS ENUM('oneThird', 'half', 'twoThirds', 'full');
  CREATE TYPE "public"."enum_footer_blocks_content_width" AS ENUM('narrow', 'wide', 'full');
  CREATE TABLE "pages_blocks_newsletter_signup" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"heading" varchar DEFAULT 'Newsletter Signup',
  	"description" varchar,
  	"button_label" varchar DEFAULT 'Subscribe',
  	"notice" jsonb,
  	"block_name" varchar
  );
  
  CREATE TABLE "_pages_v_blocks_newsletter_signup" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"heading" varchar DEFAULT 'Newsletter Signup',
  	"description" varchar,
  	"button_label" varchar DEFAULT 'Subscribe',
  	"notice" jsonb,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "footer_blocks_content_columns" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"size" "enum_footer_blocks_content_columns_size" DEFAULT 'oneThird',
  	"rich_text" jsonb
  );
  
  CREATE TABLE "footer_blocks_content" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"width" "enum_footer_blocks_content_width" DEFAULT 'narrow',
  	"block_name" varchar
  );
  
  ALTER TABLE "pages_blocks_content" ADD COLUMN "width" "enum_pages_blocks_content_width" DEFAULT 'narrow';
  ALTER TABLE "_pages_v_blocks_content" ADD COLUMN "width" "enum__pages_v_blocks_content_width" DEFAULT 'narrow';
  ALTER TABLE "pages_blocks_newsletter_signup" ADD CONSTRAINT "pages_blocks_newsletter_signup_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_newsletter_signup" ADD CONSTRAINT "_pages_v_blocks_newsletter_signup_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "footer_blocks_content_columns" ADD CONSTRAINT "footer_blocks_content_columns_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."footer_blocks_content"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "footer_blocks_content" ADD CONSTRAINT "footer_blocks_content_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."footer"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "pages_blocks_newsletter_signup_order_idx" ON "pages_blocks_newsletter_signup" USING btree ("_order");
  CREATE INDEX "pages_blocks_newsletter_signup_parent_id_idx" ON "pages_blocks_newsletter_signup" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_newsletter_signup_path_idx" ON "pages_blocks_newsletter_signup" USING btree ("_path");
  CREATE INDEX "_pages_v_blocks_newsletter_signup_order_idx" ON "_pages_v_blocks_newsletter_signup" USING btree ("_order");
  CREATE INDEX "_pages_v_blocks_newsletter_signup_parent_id_idx" ON "_pages_v_blocks_newsletter_signup" USING btree ("_parent_id");
  CREATE INDEX "_pages_v_blocks_newsletter_signup_path_idx" ON "_pages_v_blocks_newsletter_signup" USING btree ("_path");
  CREATE INDEX "footer_blocks_content_columns_order_idx" ON "footer_blocks_content_columns" USING btree ("_order");
  CREATE INDEX "footer_blocks_content_columns_parent_id_idx" ON "footer_blocks_content_columns" USING btree ("_parent_id");
  CREATE INDEX "footer_blocks_content_order_idx" ON "footer_blocks_content" USING btree ("_order");
  CREATE INDEX "footer_blocks_content_parent_id_idx" ON "footer_blocks_content" USING btree ("_parent_id");
  CREATE INDEX "footer_blocks_content_path_idx" ON "footer_blocks_content" USING btree ("_path");
  ALTER TABLE "pages_blocks_content_columns" DROP COLUMN "enable_link";
  ALTER TABLE "pages_blocks_content_columns" DROP COLUMN "link_type";
  ALTER TABLE "pages_blocks_content_columns" DROP COLUMN "link_new_tab";
  ALTER TABLE "pages_blocks_content_columns" DROP COLUMN "link_url";
  ALTER TABLE "pages_blocks_content_columns" DROP COLUMN "link_label";
  ALTER TABLE "pages_blocks_content_columns" DROP COLUMN "link_appearance";
  ALTER TABLE "_pages_v_blocks_content_columns" DROP COLUMN "enable_link";
  ALTER TABLE "_pages_v_blocks_content_columns" DROP COLUMN "link_type";
  ALTER TABLE "_pages_v_blocks_content_columns" DROP COLUMN "link_new_tab";
  ALTER TABLE "_pages_v_blocks_content_columns" DROP COLUMN "link_url";
  ALTER TABLE "_pages_v_blocks_content_columns" DROP COLUMN "link_label";
  ALTER TABLE "_pages_v_blocks_content_columns" DROP COLUMN "link_appearance";
  DROP TYPE "public"."enum_pages_blocks_content_columns_link_type";
  DROP TYPE "public"."enum_pages_blocks_content_columns_link_appearance";
  DROP TYPE "public"."enum__pages_v_blocks_content_columns_link_type";
  DROP TYPE "public"."enum__pages_v_blocks_content_columns_link_appearance";`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_pages_blocks_content_columns_link_type" AS ENUM('reference', 'custom');
  CREATE TYPE "public"."enum_pages_blocks_content_columns_link_appearance" AS ENUM('default', 'outline');
  CREATE TYPE "public"."enum__pages_v_blocks_content_columns_link_type" AS ENUM('reference', 'custom');
  CREATE TYPE "public"."enum__pages_v_blocks_content_columns_link_appearance" AS ENUM('default', 'outline');
  DROP TABLE "pages_blocks_newsletter_signup" CASCADE;
  DROP TABLE "_pages_v_blocks_newsletter_signup" CASCADE;
  DROP TABLE "footer_blocks_content_columns" CASCADE;
  DROP TABLE "footer_blocks_content" CASCADE;
  ALTER TABLE "pages_blocks_content_columns" ADD COLUMN "enable_link" boolean;
  ALTER TABLE "pages_blocks_content_columns" ADD COLUMN "link_type" "enum_pages_blocks_content_columns_link_type" DEFAULT 'reference';
  ALTER TABLE "pages_blocks_content_columns" ADD COLUMN "link_new_tab" boolean;
  ALTER TABLE "pages_blocks_content_columns" ADD COLUMN "link_url" varchar;
  ALTER TABLE "pages_blocks_content_columns" ADD COLUMN "link_label" varchar;
  ALTER TABLE "pages_blocks_content_columns" ADD COLUMN "link_appearance" "enum_pages_blocks_content_columns_link_appearance" DEFAULT 'default';
  ALTER TABLE "_pages_v_blocks_content_columns" ADD COLUMN "enable_link" boolean;
  ALTER TABLE "_pages_v_blocks_content_columns" ADD COLUMN "link_type" "enum__pages_v_blocks_content_columns_link_type" DEFAULT 'reference';
  ALTER TABLE "_pages_v_blocks_content_columns" ADD COLUMN "link_new_tab" boolean;
  ALTER TABLE "_pages_v_blocks_content_columns" ADD COLUMN "link_url" varchar;
  ALTER TABLE "_pages_v_blocks_content_columns" ADD COLUMN "link_label" varchar;
  ALTER TABLE "_pages_v_blocks_content_columns" ADD COLUMN "link_appearance" "enum__pages_v_blocks_content_columns_link_appearance" DEFAULT 'default';
  ALTER TABLE "pages_blocks_content" DROP COLUMN "width";
  ALTER TABLE "_pages_v_blocks_content" DROP COLUMN "width";
  DROP TYPE "public"."enum_pages_blocks_content_width";
  DROP TYPE "public"."enum__pages_v_blocks_content_width";
  DROP TYPE "public"."enum_footer_blocks_content_columns_size";
  DROP TYPE "public"."enum_footer_blocks_content_width";`)
}
