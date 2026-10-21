import { MigrateUpArgs, MigrateDownArgs, sql } from "@payloadcms/db-postgres"

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
  ALTER TABLE "docs" ADD COLUMN "_order" varchar;
  ALTER TABLE "docs" ADD COLUMN "parent_id" integer;
  ALTER TABLE "_docs_v" ADD COLUMN "version__order" varchar;
  ALTER TABLE "_docs_v" ADD COLUMN "version_parent_id" integer;`)

  // A site that has docs in sections keeps them where they were: each area and section that
  // holds docs becomes a doc of its own, a draft, with the docs under it as its children.
  // Recorded as seeded and offered, so the next deploy offers the repo's copy of each as a new
  // draft version for an editor to publish, as it does for a doc whose file has changed.
  await db.execute(sql`
  WITH RECURSIVE "used" AS (
    SELECT DISTINCT "section_id" AS "id" FROM "docs" WHERE "section_id" IS NOT NULL
    UNION
    SELECT "s"."parent_id" FROM "doc_sections" "s" JOIN "used" ON "used"."id" = "s"."id"
    WHERE "s"."parent_id" IS NOT NULL
  )
  INSERT INTO "docs" ("title", "slug", "generate_slug", "_order", "source_hash", "_status")
  SELECT "s"."title", "s"."slug", false, "s"."_order", 'doc-sections', 'draft'
  FROM "doc_sections" "s" JOIN "used" ON "used"."id" = "s"."id"
  WHERE NOT EXISTS (SELECT 1 FROM "docs" "d" WHERE "d"."slug" = "s"."slug");

  UPDATE "docs" SET "parent_id" = "p"."id"
  FROM "doc_sections" "s"
  JOIN "doc_sections" "sp" ON "sp"."id" = "s"."parent_id"
  JOIN "docs" "p" ON "p"."slug" = "sp"."slug"
  WHERE "docs"."source_hash" = 'doc-sections' AND "docs"."slug" = "s"."slug";

  -- The docs in each section, in the sidebar's order (by name), after the areas and sections.
  UPDATE "docs" SET "parent_id" = "placed"."parent_id", "_order" = "placed"."order"
  FROM (
    SELECT "d"."id", "p"."id" AS "parent_id",
      'b' || substr('0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz', ("n" / 62)::int + 1, 1)
          || substr('0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz', ("n" % 62)::int + 1, 1) AS "order"
    FROM (
      SELECT "id", "slug", "section_id",
        row_number() OVER (ORDER BY "section_id" NULLS LAST, coalesce("nav_title", "title"), "id") - 1 AS "n"
      FROM "docs" WHERE "source_hash" IS DISTINCT FROM 'doc-sections'
    ) "d"
    LEFT JOIN "doc_sections" "s" ON "s"."id" = "d"."section_id"
    LEFT JOIN "docs" "p" ON "p"."slug" = "s"."slug" AND "p"."source_hash" = 'doc-sections'
      -- The home doc is /docs itself, above every area.
      AND "d"."slug" <> 'home'
  ) "placed"
  WHERE "docs"."id" = "placed"."id";

  UPDATE "_docs_v" SET "version_parent_id" = "d"."parent_id", "version__order" = "d"."_order"
  FROM "docs" "d" WHERE "_docs_v"."parent_id" = "d"."id";

  INSERT INTO "_docs_v" ("parent_id", "version_title", "version_slug", "version_generate_slug",
    "version__order", "version_parent_id", "version_source_hash", "version__status", "latest", "autosave")
  SELECT "id", "title", "slug", false, "_order", "parent_id", "source_hash", 'draft', true, false
  FROM "docs" WHERE "source_hash" = 'doc-sections';

  INSERT INTO "payload_kv" ("key", "data")
  SELECT 'seeded:docs:' || "d"."slug", jsonb_build_object('at', now())
  FROM "docs" "d" WHERE "d"."source_hash" = 'doc-sections'
  ON CONFLICT ("key") DO NOTHING;

  INSERT INTO "payload_kv" ("key", "data")
  SELECT 'offered:docs:' || "d"."slug",
    jsonb_build_object('hash', 'doc-sections', 'version', "v"."id", 'at', now())
  FROM "docs" "d" JOIN "_docs_v" "v" ON "v"."parent_id" = "d"."id"
  WHERE "d"."source_hash" = 'doc-sections'
  ON CONFLICT ("key") DO UPDATE SET "data" = excluded."data";`)

  await db.execute(sql`
   CREATE TABLE "docs_breadcrumbs" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"doc_id" integer,
  	"url" varchar,
  	"label" varchar
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
  
  ALTER TABLE "docs" DROP CONSTRAINT "docs_section_id_doc_sections_id_fk";
  
  ALTER TABLE "_docs_v" DROP CONSTRAINT "_docs_v_version_section_id_doc_sections_id_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_doc_sections_fk";
  
  DROP INDEX "docs_section_idx";
  DROP INDEX "_docs_v_version_version_section_idx";
  DROP INDEX "payload_locked_documents_rels_doc_sections_id_idx";
  ALTER TABLE "doc_sections_breadcrumbs" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "doc_sections" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "doc_sections_breadcrumbs" CASCADE;
  DROP TABLE "doc_sections" CASCADE;
  ALTER TABLE "docs_breadcrumbs" ADD CONSTRAINT "docs_breadcrumbs_doc_id_docs_id_fk" FOREIGN KEY ("doc_id") REFERENCES "public"."docs"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "docs_breadcrumbs" ADD CONSTRAINT "docs_breadcrumbs_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."docs"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_docs_v_version_breadcrumbs" ADD CONSTRAINT "_docs_v_version_breadcrumbs_doc_id_docs_id_fk" FOREIGN KEY ("doc_id") REFERENCES "public"."docs"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_docs_v_version_breadcrumbs" ADD CONSTRAINT "_docs_v_version_breadcrumbs_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_docs_v"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "docs_breadcrumbs_order_idx" ON "docs_breadcrumbs" USING btree ("_order");
  CREATE INDEX "docs_breadcrumbs_parent_id_idx" ON "docs_breadcrumbs" USING btree ("_parent_id");
  CREATE INDEX "docs_breadcrumbs_doc_idx" ON "docs_breadcrumbs" USING btree ("doc_id");
  CREATE INDEX "_docs_v_version_breadcrumbs_order_idx" ON "_docs_v_version_breadcrumbs" USING btree ("_order");
  CREATE INDEX "_docs_v_version_breadcrumbs_parent_id_idx" ON "_docs_v_version_breadcrumbs" USING btree ("_parent_id");
  CREATE INDEX "_docs_v_version_breadcrumbs_doc_idx" ON "_docs_v_version_breadcrumbs" USING btree ("doc_id");
  ALTER TABLE "docs" ADD CONSTRAINT "docs_parent_id_docs_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."docs"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_docs_v" ADD CONSTRAINT "_docs_v_version_parent_id_docs_id_fk" FOREIGN KEY ("version_parent_id") REFERENCES "public"."docs"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "docs__order_idx" ON "docs" USING btree ("_order");
  CREATE INDEX "docs_parent_idx" ON "docs" USING btree ("parent_id");
  CREATE INDEX "_docs_v_version_version__order_idx" ON "_docs_v" USING btree ("version__order");
  CREATE INDEX "_docs_v_version_version_parent_idx" ON "_docs_v" USING btree ("version_parent_id");
  ALTER TABLE "docs" DROP COLUMN "section_id";
  ALTER TABLE "_docs_v" DROP COLUMN "version_section_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "doc_sections_id";`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
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
  
  ALTER TABLE "docs_breadcrumbs" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_docs_v_version_breadcrumbs" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "docs_breadcrumbs" CASCADE;
  DROP TABLE "_docs_v_version_breadcrumbs" CASCADE;
  ALTER TABLE "docs" DROP CONSTRAINT "docs_parent_id_docs_id_fk";
  
  ALTER TABLE "_docs_v" DROP CONSTRAINT "_docs_v_version_parent_id_docs_id_fk";
  
  DROP INDEX "docs__order_idx";
  DROP INDEX "docs_parent_idx";
  DROP INDEX "_docs_v_version_version__order_idx";
  DROP INDEX "_docs_v_version_version_parent_idx";
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
  ALTER TABLE "docs" DROP COLUMN "_order";
  ALTER TABLE "docs" DROP COLUMN "parent_id";
  ALTER TABLE "_docs_v" DROP COLUMN "version__order";
  ALTER TABLE "_docs_v" DROP COLUMN "version_parent_id";`)
}
