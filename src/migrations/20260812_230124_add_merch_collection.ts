import { MigrateUpArgs, MigrateDownArgs, sql } from "@payloadcms/db-postgres"

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_pages_blocks_merch_layout" AS ENUM('square', 'fullWidth');
  CREATE TYPE "public"."enum_pages_blocks_merch_source" AS ENUM('all', 'filtered');
  CREATE TYPE "public"."enum_pages_blocks_merch_order_by" AS ENUM('sortOrder', 'title', 'newest');
  CREATE TYPE "public"."enum__pages_v_blocks_merch_layout" AS ENUM('square', 'fullWidth');
  CREATE TYPE "public"."enum__pages_v_blocks_merch_source" AS ENUM('all', 'filtered');
  CREATE TYPE "public"."enum__pages_v_blocks_merch_order_by" AS ENUM('sortOrder', 'title', 'newest');
  CREATE TYPE "public"."enum_merch_source" AS ENUM('shopify');
  CREATE TYPE "public"."enum_merch_status" AS ENUM('active', 'archived');
  ALTER TYPE "public"."enum_payload_jobs_log_task_slug" ADD VALUE 'syncShopifyProducts' BEFORE 'schedulePublish';
  ALTER TYPE "public"."enum_payload_jobs_task_slug" ADD VALUE 'syncShopifyProducts' BEFORE 'schedulePublish';
  CREATE TABLE "pages_blocks_merch" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"heading" varchar DEFAULT 'The Pragmatic Papers Store',
  	"layout" "enum_pages_blocks_merch_layout" DEFAULT 'fullWidth',
  	"autoplay" boolean DEFAULT false,
  	"source" "enum_pages_blocks_merch_source" DEFAULT 'all',
  	"collection" varchar,
  	"tag" varchar,
  	"featured_only" boolean DEFAULT false,
  	"order_by" "enum_pages_blocks_merch_order_by" DEFAULT 'sortOrder',
  	"limit" numeric DEFAULT 12,
  	"block_name" varchar
  );
  
  CREATE TABLE "_pages_v_blocks_merch" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"heading" varchar DEFAULT 'The Pragmatic Papers Store',
  	"layout" "enum__pages_v_blocks_merch_layout" DEFAULT 'fullWidth',
  	"autoplay" boolean DEFAULT false,
  	"source" "enum__pages_v_blocks_merch_source" DEFAULT 'all',
  	"collection" varchar,
  	"tag" varchar,
  	"featured_only" boolean DEFAULT false,
  	"order_by" "enum__pages_v_blocks_merch_order_by" DEFAULT 'sortOrder',
  	"limit" numeric DEFAULT 12,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "merch" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar NOT NULL,
  	"external_id" varchar NOT NULL,
  	"source" "enum_merch_source" DEFAULT 'shopify',
  	"handle" varchar NOT NULL,
  	"description" varchar,
  	"price" varchar,
  	"compare_at_price" varchar,
  	"currency_code" varchar,
  	"available_for_sale" boolean,
  	"image_url" varchar,
  	"image_width" numeric,
  	"image_height" numeric,
  	"image_alt" varchar,
  	"status" "enum_merch_status" DEFAULT 'active',
  	"last_synced_at" timestamp(3) with time zone,
  	"featured" boolean DEFAULT false,
  	"hidden" boolean DEFAULT false,
  	"badge_override" varchar,
  	"sort_order" numeric,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "merch_texts" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"text" varchar
  );
  
  ALTER TABLE "pages_rels" ADD COLUMN "merch_id" integer;
  ALTER TABLE "_pages_v_rels" ADD COLUMN "merch_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "merch_id" integer;
  ALTER TABLE "pages_blocks_merch" ADD CONSTRAINT "pages_blocks_merch_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_merch" ADD CONSTRAINT "_pages_v_blocks_merch_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "merch_texts" ADD CONSTRAINT "merch_texts_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."merch"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "pages_blocks_merch_order_idx" ON "pages_blocks_merch" USING btree ("_order");
  CREATE INDEX "pages_blocks_merch_parent_id_idx" ON "pages_blocks_merch" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_merch_path_idx" ON "pages_blocks_merch" USING btree ("_path");
  CREATE INDEX "_pages_v_blocks_merch_order_idx" ON "_pages_v_blocks_merch" USING btree ("_order");
  CREATE INDEX "_pages_v_blocks_merch_parent_id_idx" ON "_pages_v_blocks_merch" USING btree ("_parent_id");
  CREATE INDEX "_pages_v_blocks_merch_path_idx" ON "_pages_v_blocks_merch" USING btree ("_path");
  CREATE UNIQUE INDEX "merch_external_id_idx" ON "merch" USING btree ("external_id");
  CREATE INDEX "merch_source_idx" ON "merch" USING btree ("source");
  CREATE UNIQUE INDEX "merch_handle_idx" ON "merch" USING btree ("handle");
  CREATE INDEX "merch_status_idx" ON "merch" USING btree ("status");
  CREATE INDEX "merch_updated_at_idx" ON "merch" USING btree ("updated_at");
  CREATE INDEX "merch_created_at_idx" ON "merch" USING btree ("created_at");
  CREATE INDEX "merch_texts_order_parent" ON "merch_texts" USING btree ("order","parent_id");
  CREATE INDEX "merch_texts_text_idx" ON "merch_texts" USING btree ("text");
  ALTER TABLE "pages_rels" ADD CONSTRAINT "pages_rels_merch_fk" FOREIGN KEY ("merch_id") REFERENCES "public"."merch"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_rels" ADD CONSTRAINT "_pages_v_rels_merch_fk" FOREIGN KEY ("merch_id") REFERENCES "public"."merch"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_merch_fk" FOREIGN KEY ("merch_id") REFERENCES "public"."merch"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "pages_rels_merch_id_idx" ON "pages_rels" USING btree ("merch_id");
  CREATE INDEX "_pages_v_rels_merch_id_idx" ON "_pages_v_rels" USING btree ("merch_id");
  CREATE INDEX "payload_locked_documents_rels_merch_id_idx" ON "payload_locked_documents_rels" USING btree ("merch_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "pages_blocks_merch" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_pages_v_blocks_merch" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "merch" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "merch_texts" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "pages_blocks_merch" CASCADE;
  DROP TABLE "_pages_v_blocks_merch" CASCADE;
  DROP TABLE "merch" CASCADE;
  DROP TABLE "merch_texts" CASCADE;
  ALTER TABLE "pages_rels" DROP CONSTRAINT "pages_rels_merch_fk";
  
  ALTER TABLE "_pages_v_rels" DROP CONSTRAINT "_pages_v_rels_merch_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_merch_fk";
  
  ALTER TABLE "payload_jobs_log" ALTER COLUMN "task_slug" SET DATA TYPE text;
  DROP TYPE "public"."enum_payload_jobs_log_task_slug";
  CREATE TYPE "public"."enum_payload_jobs_log_task_slug" AS ENUM('inline', 'updateRecommendations', 'schedulePublish');
  ALTER TABLE "payload_jobs_log" ALTER COLUMN "task_slug" SET DATA TYPE "public"."enum_payload_jobs_log_task_slug" USING "task_slug"::"public"."enum_payload_jobs_log_task_slug";
  ALTER TABLE "payload_jobs" ALTER COLUMN "task_slug" SET DATA TYPE text;
  DROP TYPE "public"."enum_payload_jobs_task_slug";
  CREATE TYPE "public"."enum_payload_jobs_task_slug" AS ENUM('inline', 'updateRecommendations', 'schedulePublish');
  ALTER TABLE "payload_jobs" ALTER COLUMN "task_slug" SET DATA TYPE "public"."enum_payload_jobs_task_slug" USING "task_slug"::"public"."enum_payload_jobs_task_slug";
  DROP INDEX "pages_rels_merch_id_idx";
  DROP INDEX "_pages_v_rels_merch_id_idx";
  DROP INDEX "payload_locked_documents_rels_merch_id_idx";
  ALTER TABLE "pages_rels" DROP COLUMN "merch_id";
  ALTER TABLE "_pages_v_rels" DROP COLUMN "merch_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "merch_id";
  DROP TYPE "public"."enum_pages_blocks_merch_layout";
  DROP TYPE "public"."enum_pages_blocks_merch_source";
  DROP TYPE "public"."enum_pages_blocks_merch_order_by";
  DROP TYPE "public"."enum__pages_v_blocks_merch_layout";
  DROP TYPE "public"."enum__pages_v_blocks_merch_source";
  DROP TYPE "public"."enum__pages_v_blocks_merch_order_by";
  DROP TYPE "public"."enum_merch_source";
  DROP TYPE "public"."enum_merch_status";`)
}
