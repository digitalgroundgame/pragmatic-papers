import { MigrateUpArgs, MigrateDownArgs, sql } from "@payloadcms/db-postgres"

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_map_assets_source_type" AS ENUM('reference', 'custom');
  CREATE TYPE "public"."enum_map_assets_source_variant" AS ENUM('link', 'default', 'outline', 'ghost', 'branded');
  CREATE TABLE "map_assets" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"label" varchar,
  	"svg_content" varchar,
  	"source_type" "enum_map_assets_source_type" DEFAULT 'custom',
  	"source_new_tab" boolean,
  	"source_variant" "enum_map_assets_source_variant" DEFAULT 'link',
  	"source_url" varchar,
  	"source_label" varchar,
  	"created_by_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"url" varchar,
  	"thumbnail_u_r_l" varchar,
  	"filename" varchar,
  	"mime_type" varchar,
  	"filesize" numeric,
  	"width" numeric,
  	"height" numeric,
  	"focal_x" numeric,
  	"focal_y" numeric
  );
  
  CREATE TABLE "map_assets_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"pages_id" integer,
  	"volumes_id" integer,
  	"articles_id" integer,
  	"topics_id" integer
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "map_assets_id" integer;
  ALTER TABLE "map_assets" ADD CONSTRAINT "map_assets_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "map_assets_rels" ADD CONSTRAINT "map_assets_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."map_assets"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "map_assets_rels" ADD CONSTRAINT "map_assets_rels_pages_fk" FOREIGN KEY ("pages_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "map_assets_rels" ADD CONSTRAINT "map_assets_rels_volumes_fk" FOREIGN KEY ("volumes_id") REFERENCES "public"."volumes"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "map_assets_rels" ADD CONSTRAINT "map_assets_rels_articles_fk" FOREIGN KEY ("articles_id") REFERENCES "public"."articles"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "map_assets_rels" ADD CONSTRAINT "map_assets_rels_topics_fk" FOREIGN KEY ("topics_id") REFERENCES "public"."topics"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "map_assets_created_by_idx" ON "map_assets" USING btree ("created_by_id");
  CREATE INDEX "map_assets_updated_at_idx" ON "map_assets" USING btree ("updated_at");
  CREATE INDEX "map_assets_created_at_idx" ON "map_assets" USING btree ("created_at");
  CREATE UNIQUE INDEX "map_assets_filename_idx" ON "map_assets" USING btree ("filename");
  CREATE INDEX "map_assets_rels_order_idx" ON "map_assets_rels" USING btree ("order");
  CREATE INDEX "map_assets_rels_parent_idx" ON "map_assets_rels" USING btree ("parent_id");
  CREATE INDEX "map_assets_rels_path_idx" ON "map_assets_rels" USING btree ("path");
  CREATE INDEX "map_assets_rels_pages_id_idx" ON "map_assets_rels" USING btree ("pages_id");
  CREATE INDEX "map_assets_rels_volumes_id_idx" ON "map_assets_rels" USING btree ("volumes_id");
  CREATE INDEX "map_assets_rels_articles_id_idx" ON "map_assets_rels" USING btree ("articles_id");
  CREATE INDEX "map_assets_rels_topics_id_idx" ON "map_assets_rels" USING btree ("topics_id");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_map_assets_fk" FOREIGN KEY ("map_assets_id") REFERENCES "public"."map_assets"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_map_assets_id_idx" ON "payload_locked_documents_rels" USING btree ("map_assets_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "map_assets" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "map_assets_rels" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "map_assets" CASCADE;
  DROP TABLE "map_assets_rels" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_map_assets_fk";
  
  DROP INDEX "payload_locked_documents_rels_map_assets_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "map_assets_id";
  DROP TYPE "public"."enum_map_assets_source_type";
  DROP TYPE "public"."enum_map_assets_source_variant";`)
}
