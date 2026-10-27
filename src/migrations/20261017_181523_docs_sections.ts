import { MigrateUpArgs, MigrateDownArgs, sql } from "@payloadcms/db-postgres"

// The docs' sections move from a fixed list in code to the Doc sections collection, which
// editors own: areas (Writing) with sections under them (Articles).

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "doc_sections_breadcrumbs" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"doc_id" integer,
  	"url" varchar,
  	"label" varchar
  );
  
  CREATE TABLE "doc_sections" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"_order" varchar,
  	"title" varchar NOT NULL,
  	"parent_id" integer,
  	"generate_slug" boolean DEFAULT true,
  	"slug" varchar NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "docs" ADD COLUMN "section_id" integer;
  ALTER TABLE "_docs_v" ADD COLUMN "version_section_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "doc_sections_id" integer;
  ALTER TABLE "doc_sections_breadcrumbs" ADD CONSTRAINT "doc_sections_breadcrumbs_doc_id_doc_sections_id_fk" FOREIGN KEY ("doc_id") REFERENCES "public"."doc_sections"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "doc_sections_breadcrumbs" ADD CONSTRAINT "doc_sections_breadcrumbs_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."doc_sections"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "doc_sections" ADD CONSTRAINT "doc_sections_parent_id_doc_sections_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."doc_sections"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "doc_sections_breadcrumbs_order_idx" ON "doc_sections_breadcrumbs" USING btree ("_order");
  CREATE INDEX "doc_sections_breadcrumbs_parent_id_idx" ON "doc_sections_breadcrumbs" USING btree ("_parent_id");
  CREATE INDEX "doc_sections_breadcrumbs_doc_idx" ON "doc_sections_breadcrumbs" USING btree ("doc_id");
  CREATE INDEX "doc_sections__order_idx" ON "doc_sections" USING btree ("_order");
  CREATE INDEX "doc_sections_parent_idx" ON "doc_sections" USING btree ("parent_id");
  CREATE UNIQUE INDEX "doc_sections_slug_idx" ON "doc_sections" USING btree ("slug");
  CREATE INDEX "doc_sections_updated_at_idx" ON "doc_sections" USING btree ("updated_at");
  CREATE INDEX "doc_sections_created_at_idx" ON "doc_sections" USING btree ("created_at");
  ALTER TABLE "docs" ADD CONSTRAINT "docs_section_id_doc_sections_id_fk" FOREIGN KEY ("section_id") REFERENCES "public"."doc_sections"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_docs_v" ADD CONSTRAINT "_docs_v_version_section_id_doc_sections_id_fk" FOREIGN KEY ("version_section_id") REFERENCES "public"."doc_sections"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_doc_sections_fk" FOREIGN KEY ("doc_sections_id") REFERENCES "public"."doc_sections"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "docs_section_idx" ON "docs" USING btree ("section_id");
  CREATE INDEX "_docs_v_version_version_section_idx" ON "_docs_v" USING btree ("version_section_id");
  CREATE INDEX "payload_locked_documents_rels_doc_sections_id_idx" ON "payload_locked_documents_rels" USING btree ("doc_sections_id");
  -- A site that has docs gets the starter areas and sections here (src/docs/sections.json as
  -- this release ships it), so each doc keeps its section; a deploy seeds them on any other.
  INSERT INTO "doc_sections" ("_order", "title", "slug", "generate_slug")
  SELECT "v"."order", "v"."title", "v"."slug", false
  FROM (VALUES
    ('a0', 'Reading', 'reading'),
    ('a1', 'Writing', 'writing'),
    ('a2', 'Getting started', 'getting-started'),
    ('a3', 'Articles', 'articles'),
    ('a4', 'Blocks', 'blocks'),
    ('a5', 'Media', 'media'),
    ('a6', 'Editing', 'editing'),
    ('a7', 'Pages and volumes', 'pages-and-volumes'),
    ('a8', 'Moderation', 'moderation'),
    ('a9', 'Site settings', 'site-settings'),
    ('aa', 'Development', 'development')
  ) AS "v"("order", "title", "slug")
  WHERE EXISTS (SELECT 1 FROM "docs") OR EXISTS (SELECT 1 FROM "_docs_v");

  UPDATE "doc_sections" SET "parent_id" = "area"."id"
  FROM "doc_sections" "area", (VALUES
    ('getting-started', 'writing'),
    ('articles', 'writing'),
    ('blocks', 'writing'),
    ('media', 'writing'),
    ('pages-and-volumes', 'editing'),
    ('moderation', 'editing'),
    ('site-settings', 'editing')
  ) AS "v"("section", "area")
  WHERE "doc_sections"."slug" = "v"."section" AND "area"."slug" = "v"."area";

  -- The old Writing section is Articles; the old Site one is Site settings, and the next deploy
  -- offers the docs that moved out of it as drafts in their new sections.
  UPDATE "docs" SET "section_id" = "s"."id"
  FROM "doc_sections" "s"
  WHERE "s"."slug" = CASE "docs"."section"::text
    WHEN 'writing' THEN 'articles' WHEN 'site' THEN 'site-settings' ELSE "docs"."section"::text END;
  UPDATE "_docs_v" SET "version_section_id" = "s"."id"
  FROM "doc_sections" "s"
  WHERE "s"."slug" = CASE "_docs_v"."version_section"::text
    WHEN 'writing' THEN 'articles' WHEN 'site' THEN 'site-settings' ELSE "_docs_v"."version_section"::text END;

  ALTER TABLE "docs" DROP COLUMN "section";
  ALTER TABLE "_docs_v" DROP COLUMN "version_section";
  DROP TYPE "public"."enum_docs_section";
  DROP TYPE "public"."enum__docs_v_version_section";`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_docs_section" AS ENUM('getting-started', 'writing', 'blocks', 'media', 'site');
  CREATE TYPE "public"."enum__docs_v_version_section" AS ENUM('getting-started', 'writing', 'blocks', 'media', 'site');
  ALTER TABLE "docs" ADD COLUMN "section" "enum_docs_section" DEFAULT 'getting-started';
  ALTER TABLE "_docs_v" ADD COLUMN "version_section" "enum__docs_v_version_section" DEFAULT 'getting-started';

  -- Back to the old sections by slug; a doc in one they didn't have is in Getting started.
  UPDATE "docs" SET "section" = (CASE "s"."slug"
    WHEN 'articles' THEN 'writing' WHEN 'blocks' THEN 'blocks' WHEN 'media' THEN 'media'
    WHEN 'pages-and-volumes' THEN 'site' WHEN 'moderation' THEN 'site' WHEN 'site-settings' THEN 'site'
    ELSE 'getting-started' END)::"enum_docs_section"
  FROM "doc_sections" "s" WHERE "s"."id" = "docs"."section_id";
  UPDATE "_docs_v" SET "version_section" = (CASE "s"."slug"
    WHEN 'articles' THEN 'writing' WHEN 'blocks' THEN 'blocks' WHEN 'media' THEN 'media'
    WHEN 'pages-and-volumes' THEN 'site' WHEN 'moderation' THEN 'site' WHEN 'site-settings' THEN 'site'
    ELSE 'getting-started' END)::"enum__docs_v_version_section"
  FROM "doc_sections" "s" WHERE "s"."id" = "_docs_v"."version_section_id";

  ALTER TABLE "docs" DROP CONSTRAINT "docs_section_id_doc_sections_id_fk";
  ALTER TABLE "_docs_v" DROP CONSTRAINT "_docs_v_version_section_id_doc_sections_id_fk";
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_doc_sections_fk";
  DROP INDEX "docs_section_idx";
  DROP INDEX "_docs_v_version_version_section_idx";
  DROP INDEX "payload_locked_documents_rels_doc_sections_id_idx";
  ALTER TABLE "docs" DROP COLUMN "section_id";
  ALTER TABLE "_docs_v" DROP COLUMN "version_section_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "doc_sections_id";
  DROP TABLE "doc_sections_breadcrumbs" CASCADE;
  DROP TABLE "doc_sections" CASCADE;`)
}
