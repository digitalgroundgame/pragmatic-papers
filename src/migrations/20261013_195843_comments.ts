import { MigrateUpArgs, MigrateDownArgs, sql } from "@payloadcms/db-postgres"

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_comments_status" AS ENUM('published', 'auto-hidden', 'hidden', 'deleted');
  CREATE TYPE "public"."enum_comment_violations_source" AS ENUM('check', 'moderator', 'block');
  CREATE TABLE "comments" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"body" varchar,
  	"target_id" integer NOT NULL,
  	"author_id" integer,
  	"parent_id" integer,
  	"depth" numeric DEFAULT 0 NOT NULL,
  	"status" "enum_comments_status" DEFAULT 'published' NOT NULL,
  	"moderation_reason" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "comment_violations" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"author_id" integer NOT NULL,
  	"source" "enum_comment_violations_source" DEFAULT 'block' NOT NULL,
  	"reason" varchar NOT NULL,
  	"comment_id" integer,
  	"reversed" boolean DEFAULT false,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "comment_settings" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"max_depth" numeric DEFAULT 5 NOT NULL,
  	"violation_threshold" numeric DEFAULT 3 NOT NULL,
  	"violation_window_days" numeric DEFAULT 30 NOT NULL,
  	"max_links" numeric DEFAULT 2 NOT NULL,
  	"block_duplicates" boolean DEFAULT true,
  	"require_verified_email" boolean DEFAULT false,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "comments_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "comment_violations_id" integer;
  ALTER TABLE "site_settings" ADD COLUMN "experiments_comments" boolean DEFAULT false;
  ALTER TABLE "comments" ADD CONSTRAINT "comments_target_id_articles_id_fk" FOREIGN KEY ("target_id") REFERENCES "public"."articles"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "comments" ADD CONSTRAINT "comments_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "comments" ADD CONSTRAINT "comments_parent_id_comments_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."comments"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "comment_violations" ADD CONSTRAINT "comment_violations_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "comment_violations" ADD CONSTRAINT "comment_violations_comment_id_comments_id_fk" FOREIGN KEY ("comment_id") REFERENCES "public"."comments"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "comments_target_idx" ON "comments" USING btree ("target_id");
  CREATE INDEX "comments_author_idx" ON "comments" USING btree ("author_id");
  CREATE INDEX "comments_parent_idx" ON "comments" USING btree ("parent_id");
  CREATE INDEX "comments_status_idx" ON "comments" USING btree ("status");
  CREATE INDEX "comments_updated_at_idx" ON "comments" USING btree ("updated_at");
  CREATE INDEX "comments_created_at_idx" ON "comments" USING btree ("created_at");
  CREATE INDEX "comment_violations_author_idx" ON "comment_violations" USING btree ("author_id");
  CREATE INDEX "comment_violations_comment_idx" ON "comment_violations" USING btree ("comment_id");
  CREATE INDEX "comment_violations_reversed_idx" ON "comment_violations" USING btree ("reversed");
  CREATE INDEX "comment_violations_updated_at_idx" ON "comment_violations" USING btree ("updated_at");
  CREATE INDEX "comment_violations_created_at_idx" ON "comment_violations" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_comments_fk" FOREIGN KEY ("comments_id") REFERENCES "public"."comments"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_comment_violations_fk" FOREIGN KEY ("comment_violations_id") REFERENCES "public"."comment_violations"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_comments_id_idx" ON "payload_locked_documents_rels" USING btree ("comments_id");
  CREATE INDEX "payload_locked_documents_rels_comment_violations_id_idx" ON "payload_locked_documents_rels" USING btree ("comment_violations_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "comments" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "comment_violations" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "comment_settings" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "comments" CASCADE;
  DROP TABLE "comment_violations" CASCADE;
  DROP TABLE "comment_settings" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_comments_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_comment_violations_fk";
  
  DROP INDEX "payload_locked_documents_rels_comments_id_idx";
  DROP INDEX "payload_locked_documents_rels_comment_violations_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "comments_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "comment_violations_id";
  ALTER TABLE "site_settings" DROP COLUMN "experiments_comments";
  DROP TYPE "public"."enum_comments_status";
  DROP TYPE "public"."enum_comment_violations_source";`)
}
