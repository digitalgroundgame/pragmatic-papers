import { MigrateUpArgs, MigrateDownArgs, sql } from "@payloadcms/db-postgres"

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_timeline_events_citation_type" AS ENUM('reference', 'custom');
  CREATE TYPE "public"."enum_timeline_events_citation_variant" AS ENUM('link', 'default', 'outline', 'ghost', 'branded');
  CREATE TYPE "public"."enum__timeline_v_events_citation_type" AS ENUM('reference', 'custom');
  CREATE TYPE "public"."enum__timeline_v_events_citation_variant" AS ENUM('link', 'default', 'outline', 'ghost', 'branded');
  CREATE TABLE "timeline_events" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"date" timestamp(3) with time zone,
  	"title" varchar,
  	"description" varchar,
  	"avatar_id" integer,
  	"enable_citation" boolean,
  	"citation_type" "enum_timeline_events_citation_type" DEFAULT 'reference',
  	"citation_new_tab" boolean,
  	"citation_variant" "enum_timeline_events_citation_variant" DEFAULT 'link',
  	"citation_url" varchar,
  	"citation_label" varchar
  );
  
  CREATE TABLE "timeline" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"title" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "_timeline_v_events" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"date" timestamp(3) with time zone,
  	"title" varchar,
  	"description" varchar,
  	"avatar_id" integer,
  	"enable_citation" boolean,
  	"citation_type" "enum__timeline_v_events_citation_type" DEFAULT 'reference',
  	"citation_new_tab" boolean,
  	"citation_variant" "enum__timeline_v_events_citation_variant" DEFAULT 'link',
  	"citation_url" varchar,
  	"citation_label" varchar,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_timeline_v" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  ALTER TABLE "pages_rels" ADD COLUMN "topics_id" integer;
  ALTER TABLE "_pages_v_rels" ADD COLUMN "topics_id" integer;
  ALTER TABLE "timeline_events" ADD CONSTRAINT "timeline_events_avatar_id_media_id_fk" FOREIGN KEY ("avatar_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "timeline_events" ADD CONSTRAINT "timeline_events_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."timeline"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "timeline" ADD CONSTRAINT "timeline_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_timeline_v_events" ADD CONSTRAINT "_timeline_v_events_avatar_id_media_id_fk" FOREIGN KEY ("avatar_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_timeline_v_events" ADD CONSTRAINT "_timeline_v_events_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_timeline_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_timeline_v" ADD CONSTRAINT "_timeline_v_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "timeline_events_order_idx" ON "timeline_events" USING btree ("_order");
  CREATE INDEX "timeline_events_parent_id_idx" ON "timeline_events" USING btree ("_parent_id");
  CREATE INDEX "timeline_events_avatar_idx" ON "timeline_events" USING btree ("avatar_id");
  CREATE INDEX "timeline_order_idx" ON "timeline" USING btree ("_order");
  CREATE INDEX "timeline_parent_id_idx" ON "timeline" USING btree ("_parent_id");
  CREATE INDEX "timeline_path_idx" ON "timeline" USING btree ("_path");
  CREATE INDEX "_timeline_v_events_order_idx" ON "_timeline_v_events" USING btree ("_order");
  CREATE INDEX "_timeline_v_events_parent_id_idx" ON "_timeline_v_events" USING btree ("_parent_id");
  CREATE INDEX "_timeline_v_events_avatar_idx" ON "_timeline_v_events" USING btree ("avatar_id");
  CREATE INDEX "_timeline_v_order_idx" ON "_timeline_v" USING btree ("_order");
  CREATE INDEX "_timeline_v_parent_id_idx" ON "_timeline_v" USING btree ("_parent_id");
  CREATE INDEX "_timeline_v_path_idx" ON "_timeline_v" USING btree ("_path");
  ALTER TABLE "pages_rels" ADD CONSTRAINT "pages_rels_topics_fk" FOREIGN KEY ("topics_id") REFERENCES "public"."topics"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_rels" ADD CONSTRAINT "_pages_v_rels_topics_fk" FOREIGN KEY ("topics_id") REFERENCES "public"."topics"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "pages_rels_topics_id_idx" ON "pages_rels" USING btree ("topics_id");
  CREATE INDEX "_pages_v_rels_topics_id_idx" ON "_pages_v_rels" USING btree ("topics_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "timeline_events" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "timeline" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_timeline_v_events" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_timeline_v" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "timeline_events" CASCADE;
  DROP TABLE "timeline" CASCADE;
  DROP TABLE "_timeline_v_events" CASCADE;
  DROP TABLE "_timeline_v" CASCADE;
  ALTER TABLE "pages_rels" DROP CONSTRAINT "pages_rels_topics_fk";
  
  ALTER TABLE "_pages_v_rels" DROP CONSTRAINT "_pages_v_rels_topics_fk";
  
  DROP INDEX "pages_rels_topics_id_idx";
  DROP INDEX "_pages_v_rels_topics_id_idx";
  ALTER TABLE "pages_rels" DROP COLUMN "topics_id";
  ALTER TABLE "_pages_v_rels" DROP COLUMN "topics_id";
  DROP TYPE "public"."enum_timeline_events_citation_type";
  DROP TYPE "public"."enum_timeline_events_citation_variant";
  DROP TYPE "public"."enum__timeline_v_events_citation_type";
  DROP TYPE "public"."enum__timeline_v_events_citation_variant";`)
}
