import { MigrateUpArgs, MigrateDownArgs, sql } from "@payloadcms/db-postgres"

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_embed_snapshots_platform" AS ENUM('bluesky', 'reddit', 'tiktok', 'twitter', 'youtube');
  CREATE TYPE "public"."enum_embed_snapshots_snapshot_status" AS ENUM('ok', 'not_found', 'forbidden', 'error', 'timeout', 'aborted', 'invalid_oembed_response');
  ALTER TYPE "public"."enum_payload_jobs_log_task_slug" ADD VALUE 'refreshEmbedSnapshots' BEFORE 'schedulePublish';
  ALTER TYPE "public"."enum_payload_jobs_task_slug" ADD VALUE 'refreshEmbedSnapshots' BEFORE 'schedulePublish';
  CREATE TABLE "embed_snapshots" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"key" varchar NOT NULL,
  	"url" varchar NOT NULL,
  	"platform" "enum_embed_snapshots_platform" NOT NULL,
  	"hide_media" boolean,
  	"hide_thread" boolean,
  	"snapshot_status" "enum_embed_snapshots_snapshot_status",
  	"snapshot_fetched_at" timestamp(3) with time zone,
  	"snapshot_provider_name" varchar,
  	"snapshot_provider_u_r_l" varchar,
  	"snapshot_author_name" varchar,
  	"snapshot_author_u_r_l" varchar,
  	"snapshot_title" varchar,
  	"snapshot_html" varchar,
  	"snapshot_thumbnail_u_r_l" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "embed_snapshots_id" integer;
  CREATE UNIQUE INDEX "embed_snapshots_key_idx" ON "embed_snapshots" USING btree ("key");
  CREATE INDEX "embed_snapshots_updated_at_idx" ON "embed_snapshots" USING btree ("updated_at");
  CREATE INDEX "embed_snapshots_created_at_idx" ON "embed_snapshots" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_embed_snapshots_fk" FOREIGN KEY ("embed_snapshots_id") REFERENCES "public"."embed_snapshots"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_embed_snapshots_id_idx" ON "payload_locked_documents_rels" USING btree ("embed_snapshots_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "embed_snapshots" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "embed_snapshots" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_embed_snapshots_fk";
  
  ALTER TABLE "payload_jobs_log" ALTER COLUMN "task_slug" SET DATA TYPE text;
  DROP TYPE "public"."enum_payload_jobs_log_task_slug";
  CREATE TYPE "public"."enum_payload_jobs_log_task_slug" AS ENUM('inline', 'updateRecommendations', 'syncShopifyProducts', 'syncInteractiveData', 'schedulePublish');
  ALTER TABLE "payload_jobs_log" ALTER COLUMN "task_slug" SET DATA TYPE "public"."enum_payload_jobs_log_task_slug" USING "task_slug"::"public"."enum_payload_jobs_log_task_slug";
  ALTER TABLE "payload_jobs" ALTER COLUMN "task_slug" SET DATA TYPE text;
  DROP TYPE "public"."enum_payload_jobs_task_slug";
  CREATE TYPE "public"."enum_payload_jobs_task_slug" AS ENUM('inline', 'updateRecommendations', 'syncShopifyProducts', 'syncInteractiveData', 'schedulePublish');
  ALTER TABLE "payload_jobs" ALTER COLUMN "task_slug" SET DATA TYPE "public"."enum_payload_jobs_task_slug" USING "task_slug"::"public"."enum_payload_jobs_task_slug";
  DROP INDEX "payload_locked_documents_rels_embed_snapshots_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "embed_snapshots_id";
  DROP TYPE "public"."enum_embed_snapshots_platform";
  DROP TYPE "public"."enum_embed_snapshots_snapshot_status";`)
}
