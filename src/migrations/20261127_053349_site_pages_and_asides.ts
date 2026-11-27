import { MigrateUpArgs, MigrateDownArgs, sql } from "@payloadcms/db-postgres"

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_topics_blocks_panel_source" AS ENUM('mostRead', 'latestVolume', 'topics', 'relatedTopics', 'contributors', 'searchTips', 'newsletter');
  CREATE TYPE "public"."enum_pages_blocks_panel_source" AS ENUM('mostRead', 'latestVolume', 'topics', 'relatedTopics', 'contributors', 'searchTips', 'newsletter');
  CREATE TYPE "public"."enum_pages_key" AS ENUM('topics');
  CREATE TYPE "public"."enum__pages_v_blocks_panel_source" AS ENUM('mostRead', 'latestVolume', 'topics', 'relatedTopics', 'contributors', 'searchTips', 'newsletter');
  CREATE TYPE "public"."enum__pages_v_version_key" AS ENUM('topics');
  CREATE TYPE "public"."enum_layouts_blocks_panel_source" AS ENUM('mostRead', 'latestVolume', 'topics', 'relatedTopics', 'contributors', 'searchTips', 'newsletter');
  CREATE TABLE "topics_blocks_panel" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"source" "enum_topics_blocks_panel_source" DEFAULT 'mostRead' NOT NULL,
  	"title" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "topics_list" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"empty_message" varchar DEFAULT 'No topics found.',
  	"block_name" varchar
  );
  
  CREATE TABLE "pages_blocks_panel" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"source" "enum_pages_blocks_panel_source" DEFAULT 'mostRead',
  	"title" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "_topics_list_v" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"empty_message" varchar DEFAULT 'No topics found.',
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "_pages_v_blocks_panel" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"source" "enum__pages_v_blocks_panel_source" DEFAULT 'mostRead',
  	"title" varchar,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "layouts_blocks_panel" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"source" "enum_layouts_blocks_panel_source" DEFAULT 'mostRead' NOT NULL,
  	"title" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "layouts" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  ALTER TABLE "pages" ADD COLUMN "key" "enum_pages_key";
  ALTER TABLE "_pages_v" ADD COLUMN "version_key" "enum__pages_v_version_key";
  ALTER TABLE "topics_blocks_panel" ADD CONSTRAINT "topics_blocks_panel_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."topics"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "topics_list" ADD CONSTRAINT "topics_list_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_panel" ADD CONSTRAINT "pages_blocks_panel_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_topics_list_v" ADD CONSTRAINT "_topics_list_v_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_panel" ADD CONSTRAINT "_pages_v_blocks_panel_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "layouts_blocks_panel" ADD CONSTRAINT "layouts_blocks_panel_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."layouts"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "topics_blocks_panel_order_idx" ON "topics_blocks_panel" USING btree ("_order");
  CREATE INDEX "topics_blocks_panel_parent_id_idx" ON "topics_blocks_panel" USING btree ("_parent_id");
  CREATE INDEX "topics_blocks_panel_path_idx" ON "topics_blocks_panel" USING btree ("_path");
  CREATE INDEX "topics_list_order_idx" ON "topics_list" USING btree ("_order");
  CREATE INDEX "topics_list_parent_id_idx" ON "topics_list" USING btree ("_parent_id");
  CREATE INDEX "topics_list_path_idx" ON "topics_list" USING btree ("_path");
  CREATE INDEX "pages_blocks_panel_order_idx" ON "pages_blocks_panel" USING btree ("_order");
  CREATE INDEX "pages_blocks_panel_parent_id_idx" ON "pages_blocks_panel" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_panel_path_idx" ON "pages_blocks_panel" USING btree ("_path");
  CREATE INDEX "_topics_list_v_order_idx" ON "_topics_list_v" USING btree ("_order");
  CREATE INDEX "_topics_list_v_parent_id_idx" ON "_topics_list_v" USING btree ("_parent_id");
  CREATE INDEX "_topics_list_v_path_idx" ON "_topics_list_v" USING btree ("_path");
  CREATE INDEX "_pages_v_blocks_panel_order_idx" ON "_pages_v_blocks_panel" USING btree ("_order");
  CREATE INDEX "_pages_v_blocks_panel_parent_id_idx" ON "_pages_v_blocks_panel" USING btree ("_parent_id");
  CREATE INDEX "_pages_v_blocks_panel_path_idx" ON "_pages_v_blocks_panel" USING btree ("_path");
  CREATE INDEX "layouts_blocks_panel_order_idx" ON "layouts_blocks_panel" USING btree ("_order");
  CREATE INDEX "layouts_blocks_panel_parent_id_idx" ON "layouts_blocks_panel" USING btree ("_parent_id");
  CREATE INDEX "layouts_blocks_panel_path_idx" ON "layouts_blocks_panel" USING btree ("_path");
  CREATE UNIQUE INDEX "pages_key_idx" ON "pages" USING btree ("key");
  CREATE INDEX "_pages_v_version_version_key_idx" ON "_pages_v" USING btree ("version_key");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "topics_blocks_panel" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "topics_list" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "pages_blocks_panel" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_topics_list_v" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_pages_v_blocks_panel" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "layouts_blocks_panel" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "layouts" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "topics_blocks_panel" CASCADE;
  DROP TABLE "topics_list" CASCADE;
  DROP TABLE "pages_blocks_panel" CASCADE;
  DROP TABLE "_topics_list_v" CASCADE;
  DROP TABLE "_pages_v_blocks_panel" CASCADE;
  DROP TABLE "layouts_blocks_panel" CASCADE;
  DROP TABLE "layouts" CASCADE;
  DROP INDEX "pages_key_idx";
  DROP INDEX "_pages_v_version_version_key_idx";
  ALTER TABLE "pages" DROP COLUMN "key";
  ALTER TABLE "_pages_v" DROP COLUMN "version_key";
  DROP TYPE "public"."enum_topics_blocks_panel_source";
  DROP TYPE "public"."enum_pages_blocks_panel_source";
  DROP TYPE "public"."enum_pages_key";
  DROP TYPE "public"."enum__pages_v_blocks_panel_source";
  DROP TYPE "public"."enum__pages_v_version_key";
  DROP TYPE "public"."enum_layouts_blocks_panel_source";`)
}
