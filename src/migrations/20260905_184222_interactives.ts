import { MigrateUpArgs, MigrateDownArgs, sql } from "@payloadcms/db-postgres"

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_interactives_sources_link_type" AS ENUM('reference', 'custom');
  CREATE TYPE "public"."enum_interactives_sources_link_variant" AS ENUM('link', 'default', 'outline', 'ghost', 'branded');
  CREATE TYPE "public"."enum_interactives_profile" AS ENUM('federal-courts');
  CREATE TYPE "public"."enum_interactives_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum__interactives_v_version_sources_link_type" AS ENUM('reference', 'custom');
  CREATE TYPE "public"."enum__interactives_v_version_sources_link_variant" AS ENUM('link', 'default', 'outline', 'ghost', 'branded');
  CREATE TYPE "public"."enum__interactives_v_version_profile" AS ENUM('federal-courts');
  CREATE TYPE "public"."enum__interactives_v_version_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum_interactive_snapshots_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum__interactive_snapshots_v_version_status" AS ENUM('draft', 'published');
  ALTER TYPE "public"."enum_payload_jobs_log_task_slug" ADD VALUE 'syncInteractiveData' BEFORE 'schedulePublish';
  ALTER TYPE "public"."enum_payload_jobs_task_slug" ADD VALUE 'syncInteractiveData' BEFORE 'schedulePublish';
  CREATE TABLE "interactives_sources" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"link_type" "enum_interactives_sources_link_type" DEFAULT 'custom',
  	"link_new_tab" boolean,
  	"link_variant" "enum_interactives_sources_link_variant" DEFAULT 'link',
  	"link_url" varchar,
  	"link_label" varchar
  );
  
  CREATE TABLE "interactives" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar,
  	"profile" "enum_interactives_profile",
  	"intro" jsonb,
  	"feed_enabled" boolean DEFAULT true,
  	"feed_ref" varchar DEFAULT 'main',
  	"feed_auto_publish" boolean DEFAULT false,
  	"meta_title" varchar,
  	"meta_image_id" integer,
  	"meta_description" varchar,
  	"published_at" timestamp(3) with time zone,
  	"generate_slug" boolean DEFAULT true,
  	"slug" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"_status" "enum_interactives_status" DEFAULT 'draft'
  );
  
  CREATE TABLE "interactives_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"pages_id" integer,
  	"volumes_id" integer,
  	"articles_id" integer,
  	"topics_id" integer
  );
  
  CREATE TABLE "_interactives_v_version_sources" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"link_type" "enum__interactives_v_version_sources_link_type" DEFAULT 'custom',
  	"link_new_tab" boolean,
  	"link_variant" "enum__interactives_v_version_sources_link_variant" DEFAULT 'link',
  	"link_url" varchar,
  	"link_label" varchar,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_interactives_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_title" varchar,
  	"version_profile" "enum__interactives_v_version_profile",
  	"version_intro" jsonb,
  	"version_feed_enabled" boolean DEFAULT true,
  	"version_feed_ref" varchar DEFAULT 'main',
  	"version_feed_auto_publish" boolean DEFAULT false,
  	"version_meta_title" varchar,
  	"version_meta_image_id" integer,
  	"version_meta_description" varchar,
  	"version_published_at" timestamp(3) with time zone,
  	"version_generate_slug" boolean DEFAULT true,
  	"version_slug" varchar,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"version__status" "enum__interactives_v_version_status" DEFAULT 'draft',
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"latest" boolean,
  	"autosave" boolean
  );
  
  CREATE TABLE "_interactives_v_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"pages_id" integer,
  	"volumes_id" integer,
  	"articles_id" integer,
  	"topics_id" integer
  );
  
  CREATE TABLE "interactive_snapshots" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"label" varchar,
  	"interactive_id" integer,
  	"summary" varchar,
  	"source_version" varchar,
  	"source_ref" varchar,
  	"content_hash" varchar,
  	"generated_at" timestamp(3) with time zone,
  	"synced_at" timestamp(3) with time zone,
  	"data" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"_status" "enum_interactive_snapshots_status" DEFAULT 'draft'
  );
  
  CREATE TABLE "_interactive_snapshots_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_label" varchar,
  	"version_interactive_id" integer,
  	"version_summary" varchar,
  	"version_source_version" varchar,
  	"version_source_ref" varchar,
  	"version_content_hash" varchar,
  	"version_generated_at" timestamp(3) with time zone,
  	"version_synced_at" timestamp(3) with time zone,
  	"version_data" jsonb,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"version__status" "enum__interactive_snapshots_v_version_status" DEFAULT 'draft',
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"latest" boolean
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "interactives_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "interactive_snapshots_id" integer;
  ALTER TABLE "interactives_sources" ADD CONSTRAINT "interactives_sources_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."interactives"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "interactives" ADD CONSTRAINT "interactives_meta_image_id_media_id_fk" FOREIGN KEY ("meta_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "interactives_rels" ADD CONSTRAINT "interactives_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."interactives"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "interactives_rels" ADD CONSTRAINT "interactives_rels_pages_fk" FOREIGN KEY ("pages_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "interactives_rels" ADD CONSTRAINT "interactives_rels_volumes_fk" FOREIGN KEY ("volumes_id") REFERENCES "public"."volumes"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "interactives_rels" ADD CONSTRAINT "interactives_rels_articles_fk" FOREIGN KEY ("articles_id") REFERENCES "public"."articles"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "interactives_rels" ADD CONSTRAINT "interactives_rels_topics_fk" FOREIGN KEY ("topics_id") REFERENCES "public"."topics"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_interactives_v_version_sources" ADD CONSTRAINT "_interactives_v_version_sources_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_interactives_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_interactives_v" ADD CONSTRAINT "_interactives_v_parent_id_interactives_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."interactives"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_interactives_v" ADD CONSTRAINT "_interactives_v_version_meta_image_id_media_id_fk" FOREIGN KEY ("version_meta_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_interactives_v_rels" ADD CONSTRAINT "_interactives_v_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."_interactives_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_interactives_v_rels" ADD CONSTRAINT "_interactives_v_rels_pages_fk" FOREIGN KEY ("pages_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_interactives_v_rels" ADD CONSTRAINT "_interactives_v_rels_volumes_fk" FOREIGN KEY ("volumes_id") REFERENCES "public"."volumes"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_interactives_v_rels" ADD CONSTRAINT "_interactives_v_rels_articles_fk" FOREIGN KEY ("articles_id") REFERENCES "public"."articles"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_interactives_v_rels" ADD CONSTRAINT "_interactives_v_rels_topics_fk" FOREIGN KEY ("topics_id") REFERENCES "public"."topics"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "interactive_snapshots" ADD CONSTRAINT "interactive_snapshots_interactive_id_interactives_id_fk" FOREIGN KEY ("interactive_id") REFERENCES "public"."interactives"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_interactive_snapshots_v" ADD CONSTRAINT "_interactive_snapshots_v_parent_id_interactive_snapshots_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."interactive_snapshots"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_interactive_snapshots_v" ADD CONSTRAINT "_interactive_snapshots_v_version_interactive_id_interactives_id_fk" FOREIGN KEY ("version_interactive_id") REFERENCES "public"."interactives"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "interactives_sources_order_idx" ON "interactives_sources" USING btree ("_order");
  CREATE INDEX "interactives_sources_parent_id_idx" ON "interactives_sources" USING btree ("_parent_id");
  CREATE INDEX "interactives_meta_meta_image_idx" ON "interactives" USING btree ("meta_image_id");
  CREATE UNIQUE INDEX "interactives_slug_idx" ON "interactives" USING btree ("slug");
  CREATE INDEX "interactives_updated_at_idx" ON "interactives" USING btree ("updated_at");
  CREATE INDEX "interactives_created_at_idx" ON "interactives" USING btree ("created_at");
  CREATE INDEX "interactives__status_idx" ON "interactives" USING btree ("_status");
  CREATE INDEX "interactives_rels_order_idx" ON "interactives_rels" USING btree ("order");
  CREATE INDEX "interactives_rels_parent_idx" ON "interactives_rels" USING btree ("parent_id");
  CREATE INDEX "interactives_rels_path_idx" ON "interactives_rels" USING btree ("path");
  CREATE INDEX "interactives_rels_pages_id_idx" ON "interactives_rels" USING btree ("pages_id");
  CREATE INDEX "interactives_rels_volumes_id_idx" ON "interactives_rels" USING btree ("volumes_id");
  CREATE INDEX "interactives_rels_articles_id_idx" ON "interactives_rels" USING btree ("articles_id");
  CREATE INDEX "interactives_rels_topics_id_idx" ON "interactives_rels" USING btree ("topics_id");
  CREATE INDEX "_interactives_v_version_sources_order_idx" ON "_interactives_v_version_sources" USING btree ("_order");
  CREATE INDEX "_interactives_v_version_sources_parent_id_idx" ON "_interactives_v_version_sources" USING btree ("_parent_id");
  CREATE INDEX "_interactives_v_parent_idx" ON "_interactives_v" USING btree ("parent_id");
  CREATE INDEX "_interactives_v_version_meta_version_meta_image_idx" ON "_interactives_v" USING btree ("version_meta_image_id");
  CREATE INDEX "_interactives_v_version_version_slug_idx" ON "_interactives_v" USING btree ("version_slug");
  CREATE INDEX "_interactives_v_version_version_updated_at_idx" ON "_interactives_v" USING btree ("version_updated_at");
  CREATE INDEX "_interactives_v_version_version_created_at_idx" ON "_interactives_v" USING btree ("version_created_at");
  CREATE INDEX "_interactives_v_version_version__status_idx" ON "_interactives_v" USING btree ("version__status");
  CREATE INDEX "_interactives_v_created_at_idx" ON "_interactives_v" USING btree ("created_at");
  CREATE INDEX "_interactives_v_updated_at_idx" ON "_interactives_v" USING btree ("updated_at");
  CREATE INDEX "_interactives_v_latest_idx" ON "_interactives_v" USING btree ("latest");
  CREATE INDEX "_interactives_v_autosave_idx" ON "_interactives_v" USING btree ("autosave");
  CREATE INDEX "_interactives_v_rels_order_idx" ON "_interactives_v_rels" USING btree ("order");
  CREATE INDEX "_interactives_v_rels_parent_idx" ON "_interactives_v_rels" USING btree ("parent_id");
  CREATE INDEX "_interactives_v_rels_path_idx" ON "_interactives_v_rels" USING btree ("path");
  CREATE INDEX "_interactives_v_rels_pages_id_idx" ON "_interactives_v_rels" USING btree ("pages_id");
  CREATE INDEX "_interactives_v_rels_volumes_id_idx" ON "_interactives_v_rels" USING btree ("volumes_id");
  CREATE INDEX "_interactives_v_rels_articles_id_idx" ON "_interactives_v_rels" USING btree ("articles_id");
  CREATE INDEX "_interactives_v_rels_topics_id_idx" ON "_interactives_v_rels" USING btree ("topics_id");
  CREATE UNIQUE INDEX "interactive_snapshots_interactive_idx" ON "interactive_snapshots" USING btree ("interactive_id");
  CREATE INDEX "interactive_snapshots_updated_at_idx" ON "interactive_snapshots" USING btree ("updated_at");
  CREATE INDEX "interactive_snapshots_created_at_idx" ON "interactive_snapshots" USING btree ("created_at");
  CREATE INDEX "interactive_snapshots__status_idx" ON "interactive_snapshots" USING btree ("_status");
  CREATE INDEX "_interactive_snapshots_v_parent_idx" ON "_interactive_snapshots_v" USING btree ("parent_id");
  CREATE INDEX "_interactive_snapshots_v_version_version_interactive_idx" ON "_interactive_snapshots_v" USING btree ("version_interactive_id");
  CREATE INDEX "_interactive_snapshots_v_version_version_updated_at_idx" ON "_interactive_snapshots_v" USING btree ("version_updated_at");
  CREATE INDEX "_interactive_snapshots_v_version_version_created_at_idx" ON "_interactive_snapshots_v" USING btree ("version_created_at");
  CREATE INDEX "_interactive_snapshots_v_version_version__status_idx" ON "_interactive_snapshots_v" USING btree ("version__status");
  CREATE INDEX "_interactive_snapshots_v_created_at_idx" ON "_interactive_snapshots_v" USING btree ("created_at");
  CREATE INDEX "_interactive_snapshots_v_updated_at_idx" ON "_interactive_snapshots_v" USING btree ("updated_at");
  CREATE INDEX "_interactive_snapshots_v_latest_idx" ON "_interactive_snapshots_v" USING btree ("latest");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_interactives_fk" FOREIGN KEY ("interactives_id") REFERENCES "public"."interactives"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_interactive_snapshots_fk" FOREIGN KEY ("interactive_snapshots_id") REFERENCES "public"."interactive_snapshots"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_interactives_id_idx" ON "payload_locked_documents_rels" USING btree ("interactives_id");
  CREATE INDEX "payload_locked_documents_rels_interactive_snapshots_id_idx" ON "payload_locked_documents_rels" USING btree ("interactive_snapshots_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "interactives_sources" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "interactives" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "interactives_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_interactives_v_version_sources" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_interactives_v" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_interactives_v_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "interactive_snapshots" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_interactive_snapshots_v" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "interactives_sources" CASCADE;
  DROP TABLE "interactives" CASCADE;
  DROP TABLE "interactives_rels" CASCADE;
  DROP TABLE "_interactives_v_version_sources" CASCADE;
  DROP TABLE "_interactives_v" CASCADE;
  DROP TABLE "_interactives_v_rels" CASCADE;
  DROP TABLE "interactive_snapshots" CASCADE;
  DROP TABLE "_interactive_snapshots_v" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_interactives_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_interactive_snapshots_fk";
  
  ALTER TABLE "payload_jobs_log" ALTER COLUMN "task_slug" SET DATA TYPE text;
  DROP TYPE "public"."enum_payload_jobs_log_task_slug";
  CREATE TYPE "public"."enum_payload_jobs_log_task_slug" AS ENUM('inline', 'updateRecommendations', 'syncShopifyProducts', 'schedulePublish');
  ALTER TABLE "payload_jobs_log" ALTER COLUMN "task_slug" SET DATA TYPE "public"."enum_payload_jobs_log_task_slug" USING "task_slug"::"public"."enum_payload_jobs_log_task_slug";
  ALTER TABLE "payload_jobs" ALTER COLUMN "task_slug" SET DATA TYPE text;
  DROP TYPE "public"."enum_payload_jobs_task_slug";
  CREATE TYPE "public"."enum_payload_jobs_task_slug" AS ENUM('inline', 'updateRecommendations', 'syncShopifyProducts', 'schedulePublish');
  ALTER TABLE "payload_jobs" ALTER COLUMN "task_slug" SET DATA TYPE "public"."enum_payload_jobs_task_slug" USING "task_slug"::"public"."enum_payload_jobs_task_slug";
  DROP INDEX "payload_locked_documents_rels_interactives_id_idx";
  DROP INDEX "payload_locked_documents_rels_interactive_snapshots_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "interactives_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "interactive_snapshots_id";
  DROP TYPE "public"."enum_interactives_sources_link_type";
  DROP TYPE "public"."enum_interactives_sources_link_variant";
  DROP TYPE "public"."enum_interactives_profile";
  DROP TYPE "public"."enum_interactives_status";
  DROP TYPE "public"."enum__interactives_v_version_sources_link_type";
  DROP TYPE "public"."enum__interactives_v_version_sources_link_variant";
  DROP TYPE "public"."enum__interactives_v_version_profile";
  DROP TYPE "public"."enum__interactives_v_version_status";
  DROP TYPE "public"."enum_interactive_snapshots_status";
  DROP TYPE "public"."enum__interactive_snapshots_v_version_status";`)
}
