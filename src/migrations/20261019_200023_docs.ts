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
  
  CREATE TABLE "docs_breadcrumbs" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"doc_id" integer,
  	"url" varchar,
  	"label" varchar
  );
  
  CREATE TABLE "docs" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"_order" varchar,
  	"title" varchar,
  	"nav_title" varchar,
  	"summary" varchar,
  	"hero_image_id" integer,
  	"content" jsonb,
  	"published_at" timestamp(3) with time zone,
  	"revised_at" timestamp(3) with time zone,
  	"tour" varchar,
  	"show_table_of_contents" boolean DEFAULT true,
  	"source_hash" varchar,
  	"generate_slug" boolean DEFAULT true,
  	"slug" varchar,
  	"parent_id" integer,
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
  
  CREATE TABLE "_docs_v_version_breadcrumbs" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"doc_id" integer,
  	"url" varchar,
  	"label" varchar,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_docs_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version__order" varchar,
  	"version_title" varchar,
  	"version_nav_title" varchar,
  	"version_summary" varchar,
  	"version_hero_image_id" integer,
  	"version_content" jsonb,
  	"version_published_at" timestamp(3) with time zone,
  	"version_revised_at" timestamp(3) with time zone,
  	"version_tour" varchar,
  	"version_show_table_of_contents" boolean DEFAULT true,
  	"version_source_hash" varchar,
  	"version_generate_slug" boolean DEFAULT true,
  	"version_slug" varchar,
  	"version_parent_id" integer,
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
  ALTER TABLE "docs_breadcrumbs" ADD CONSTRAINT "docs_breadcrumbs_doc_id_docs_id_fk" FOREIGN KEY ("doc_id") REFERENCES "public"."docs"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "docs_breadcrumbs" ADD CONSTRAINT "docs_breadcrumbs_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."docs"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "docs" ADD CONSTRAINT "docs_hero_image_id_media_id_fk" FOREIGN KEY ("hero_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "docs" ADD CONSTRAINT "docs_parent_id_docs_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."docs"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_docs_v_version_audience" ADD CONSTRAINT "_docs_v_version_audience_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."_docs_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_docs_v_version_breadcrumbs" ADD CONSTRAINT "_docs_v_version_breadcrumbs_doc_id_docs_id_fk" FOREIGN KEY ("doc_id") REFERENCES "public"."docs"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_docs_v_version_breadcrumbs" ADD CONSTRAINT "_docs_v_version_breadcrumbs_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_docs_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_docs_v" ADD CONSTRAINT "_docs_v_parent_id_docs_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."docs"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_docs_v" ADD CONSTRAINT "_docs_v_version_hero_image_id_media_id_fk" FOREIGN KEY ("version_hero_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_docs_v" ADD CONSTRAINT "_docs_v_version_parent_id_docs_id_fk" FOREIGN KEY ("version_parent_id") REFERENCES "public"."docs"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "docs_audience_order_idx" ON "docs_audience" USING btree ("order");
  CREATE INDEX "docs_audience_parent_idx" ON "docs_audience" USING btree ("parent_id");
  CREATE INDEX "docs_breadcrumbs_order_idx" ON "docs_breadcrumbs" USING btree ("_order");
  CREATE INDEX "docs_breadcrumbs_parent_id_idx" ON "docs_breadcrumbs" USING btree ("_parent_id");
  CREATE INDEX "docs_breadcrumbs_doc_idx" ON "docs_breadcrumbs" USING btree ("doc_id");
  CREATE INDEX "docs__order_idx" ON "docs" USING btree ("_order");
  CREATE INDEX "docs_hero_image_idx" ON "docs" USING btree ("hero_image_id");
  CREATE UNIQUE INDEX "docs_slug_idx" ON "docs" USING btree ("slug");
  CREATE INDEX "docs_parent_idx" ON "docs" USING btree ("parent_id");
  CREATE INDEX "docs_updated_at_idx" ON "docs" USING btree ("updated_at");
  CREATE INDEX "docs_created_at_idx" ON "docs" USING btree ("created_at");
  CREATE INDEX "docs__status_idx" ON "docs" USING btree ("_status");
  CREATE INDEX "_docs_v_version_audience_order_idx" ON "_docs_v_version_audience" USING btree ("order");
  CREATE INDEX "_docs_v_version_audience_parent_idx" ON "_docs_v_version_audience" USING btree ("parent_id");
  CREATE INDEX "_docs_v_version_breadcrumbs_order_idx" ON "_docs_v_version_breadcrumbs" USING btree ("_order");
  CREATE INDEX "_docs_v_version_breadcrumbs_parent_id_idx" ON "_docs_v_version_breadcrumbs" USING btree ("_parent_id");
  CREATE INDEX "_docs_v_version_breadcrumbs_doc_idx" ON "_docs_v_version_breadcrumbs" USING btree ("doc_id");
  CREATE INDEX "_docs_v_parent_idx" ON "_docs_v" USING btree ("parent_id");
  CREATE INDEX "_docs_v_version_version__order_idx" ON "_docs_v" USING btree ("version__order");
  CREATE INDEX "_docs_v_version_version_hero_image_idx" ON "_docs_v" USING btree ("version_hero_image_id");
  CREATE INDEX "_docs_v_version_version_slug_idx" ON "_docs_v" USING btree ("version_slug");
  CREATE INDEX "_docs_v_version_version_parent_idx" ON "_docs_v" USING btree ("version_parent_id");
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
  ALTER TABLE "docs_breadcrumbs" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "docs" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_docs_v_version_audience" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_docs_v_version_breadcrumbs" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_docs_v" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "docs_audience" CASCADE;
  DROP TABLE "docs_breadcrumbs" CASCADE;
  DROP TABLE "docs" CASCADE;
  DROP TABLE "_docs_v_version_audience" CASCADE;
  DROP TABLE "_docs_v_version_breadcrumbs" CASCADE;
  DROP TABLE "_docs_v" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_docs_fk";
  
  DROP INDEX "payload_locked_documents_rels_docs_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "docs_id";
  DROP TYPE "public"."enum_docs_audience";
  DROP TYPE "public"."enum_docs_status";
  DROP TYPE "public"."enum__docs_v_version_audience";
  DROP TYPE "public"."enum__docs_v_version_status";`)
}
