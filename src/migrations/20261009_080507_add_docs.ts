import { MigrateUpArgs, MigrateDownArgs, sql } from "@payloadcms/db-postgres"

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_docs_audience" AS ENUM('admin', 'chief-editor', 'editor', 'writer', 'narrator');
  CREATE TYPE "public"."enum_docs_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum__docs_v_version_audience" AS ENUM('admin', 'chief-editor', 'editor', 'writer', 'narrator');
  CREATE TYPE "public"."enum__docs_v_version_status" AS ENUM('draft', 'published');
  CREATE TABLE "docs_audience" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "enum_docs_audience",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "docs" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar,
  	"summary" varchar,
  	"content" jsonb,
  	"published_at" timestamp(3) with time zone,
  	"show_table_of_contents" boolean DEFAULT true,
  	"source_hash" varchar,
  	"generate_slug" boolean DEFAULT true,
  	"slug" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"_status" "enum_docs_status" DEFAULT 'draft'
  );
  
  CREATE TABLE "_docs_v_version_audience" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "enum__docs_v_version_audience",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "_docs_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_title" varchar,
  	"version_summary" varchar,
  	"version_content" jsonb,
  	"version_published_at" timestamp(3) with time zone,
  	"version_show_table_of_contents" boolean DEFAULT true,
  	"version_source_hash" varchar,
  	"version_generate_slug" boolean DEFAULT true,
  	"version_slug" varchar,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"version__status" "enum__docs_v_version_status" DEFAULT 'draft',
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"latest" boolean,
  	"autosave" boolean
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "docs_id" integer;
  ALTER TABLE "docs_audience" ADD CONSTRAINT "docs_audience_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."docs"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_docs_v_version_audience" ADD CONSTRAINT "_docs_v_version_audience_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."_docs_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_docs_v" ADD CONSTRAINT "_docs_v_parent_id_docs_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."docs"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "docs_audience_order_idx" ON "docs_audience" USING btree ("order");
  CREATE INDEX "docs_audience_parent_idx" ON "docs_audience" USING btree ("parent_id");
  CREATE UNIQUE INDEX "docs_slug_idx" ON "docs" USING btree ("slug");
  CREATE INDEX "docs_updated_at_idx" ON "docs" USING btree ("updated_at");
  CREATE INDEX "docs_created_at_idx" ON "docs" USING btree ("created_at");
  CREATE INDEX "docs__status_idx" ON "docs" USING btree ("_status");
  CREATE INDEX "_docs_v_version_audience_order_idx" ON "_docs_v_version_audience" USING btree ("order");
  CREATE INDEX "_docs_v_version_audience_parent_idx" ON "_docs_v_version_audience" USING btree ("parent_id");
  CREATE INDEX "_docs_v_parent_idx" ON "_docs_v" USING btree ("parent_id");
  CREATE INDEX "_docs_v_version_version_slug_idx" ON "_docs_v" USING btree ("version_slug");
  CREATE INDEX "_docs_v_version_version_updated_at_idx" ON "_docs_v" USING btree ("version_updated_at");
  CREATE INDEX "_docs_v_version_version_created_at_idx" ON "_docs_v" USING btree ("version_created_at");
  CREATE INDEX "_docs_v_version_version__status_idx" ON "_docs_v" USING btree ("version__status");
  CREATE INDEX "_docs_v_created_at_idx" ON "_docs_v" USING btree ("created_at");
  CREATE INDEX "_docs_v_updated_at_idx" ON "_docs_v" USING btree ("updated_at");
  CREATE INDEX "_docs_v_latest_idx" ON "_docs_v" USING btree ("latest");
  CREATE INDEX "_docs_v_autosave_idx" ON "_docs_v" USING btree ("autosave");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_docs_fk" FOREIGN KEY ("docs_id") REFERENCES "public"."docs"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_docs_id_idx" ON "payload_locked_documents_rels" USING btree ("docs_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "docs_audience" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "docs" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_docs_v_version_audience" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_docs_v" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "docs_audience" CASCADE;
  DROP TABLE "docs" CASCADE;
  DROP TABLE "_docs_v_version_audience" CASCADE;
  DROP TABLE "_docs_v" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_docs_fk";
  
  DROP INDEX "payload_locked_documents_rels_docs_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "docs_id";
  DROP TYPE "public"."enum_docs_audience";
  DROP TYPE "public"."enum_docs_status";
  DROP TYPE "public"."enum__docs_v_version_audience";
  DROP TYPE "public"."enum__docs_v_version_status";`)
}
