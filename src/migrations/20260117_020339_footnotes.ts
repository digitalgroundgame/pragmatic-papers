import { MigrateUpArgs, MigrateDownArgs, sql } from "@payloadcms/db-postgres"

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_articles_footnotes_link_type" AS ENUM('reference', 'custom');
  CREATE TYPE "public"."enum_articles_footnotes_link_appearance" AS ENUM('default', 'outline');
  CREATE TYPE "public"."enum__articles_v_version_footnotes_link_type" AS ENUM('reference', 'custom');
  CREATE TYPE "public"."enum__articles_v_version_footnotes_link_appearance" AS ENUM('default', 'outline');
  CREATE TABLE "articles_footnotes" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"note" varchar,
  	"index" numeric,
  	"attribution_enabled" boolean DEFAULT false,
  	"link_type" "enum_articles_footnotes_link_type" DEFAULT 'custom',
  	"link_new_tab" boolean DEFAULT true,
  	"link_url" varchar,
  	"link_label" varchar,
  	"link_appearance" "enum_articles_footnotes_link_appearance" DEFAULT 'default'
  );
  
  CREATE TABLE "_articles_v_version_footnotes" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"note" varchar,
  	"index" numeric,
  	"attribution_enabled" boolean DEFAULT false,
  	"link_type" "enum__articles_v_version_footnotes_link_type" DEFAULT 'custom',
  	"link_new_tab" boolean DEFAULT true,
  	"link_url" varchar,
  	"link_label" varchar,
  	"link_appearance" "enum__articles_v_version_footnotes_link_appearance" DEFAULT 'default',
  	"_uuid" varchar
  );
  
  ALTER TABLE "articles_rels" ADD COLUMN "pages_id" integer;
  ALTER TABLE "articles_rels" ADD COLUMN "volumes_id" integer;
  ALTER TABLE "articles_rels" ADD COLUMN "articles_id" integer;
  ALTER TABLE "_articles_v_rels" ADD COLUMN "pages_id" integer;
  ALTER TABLE "_articles_v_rels" ADD COLUMN "volumes_id" integer;
  ALTER TABLE "_articles_v_rels" ADD COLUMN "articles_id" integer;
  ALTER TABLE "articles_footnotes" ADD CONSTRAINT "articles_footnotes_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."articles"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_articles_v_version_footnotes" ADD CONSTRAINT "_articles_v_version_footnotes_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_articles_v"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "articles_footnotes_order_idx" ON "articles_footnotes" USING btree ("_order");
  CREATE INDEX "articles_footnotes_parent_id_idx" ON "articles_footnotes" USING btree ("_parent_id");
  CREATE INDEX "_articles_v_version_footnotes_order_idx" ON "_articles_v_version_footnotes" USING btree ("_order");
  CREATE INDEX "_articles_v_version_footnotes_parent_id_idx" ON "_articles_v_version_footnotes" USING btree ("_parent_id");
  ALTER TABLE "articles_rels" ADD CONSTRAINT "articles_rels_pages_fk" FOREIGN KEY ("pages_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "articles_rels" ADD CONSTRAINT "articles_rels_volumes_fk" FOREIGN KEY ("volumes_id") REFERENCES "public"."volumes"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "articles_rels" ADD CONSTRAINT "articles_rels_articles_fk" FOREIGN KEY ("articles_id") REFERENCES "public"."articles"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_articles_v_rels" ADD CONSTRAINT "_articles_v_rels_pages_fk" FOREIGN KEY ("pages_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_articles_v_rels" ADD CONSTRAINT "_articles_v_rels_volumes_fk" FOREIGN KEY ("volumes_id") REFERENCES "public"."volumes"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_articles_v_rels" ADD CONSTRAINT "_articles_v_rels_articles_fk" FOREIGN KEY ("articles_id") REFERENCES "public"."articles"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "articles_rels_pages_id_idx" ON "articles_rels" USING btree ("pages_id");
  CREATE INDEX "articles_rels_volumes_id_idx" ON "articles_rels" USING btree ("volumes_id");
  CREATE INDEX "articles_rels_articles_id_idx" ON "articles_rels" USING btree ("articles_id");
  CREATE INDEX "_articles_v_rels_pages_id_idx" ON "_articles_v_rels" USING btree ("pages_id");
  CREATE INDEX "_articles_v_rels_volumes_id_idx" ON "_articles_v_rels" USING btree ("volumes_id");
  CREATE INDEX "_articles_v_rels_articles_id_idx" ON "_articles_v_rels" USING btree ("articles_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "articles_footnotes" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_articles_v_version_footnotes" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "articles_footnotes" CASCADE;
  DROP TABLE "_articles_v_version_footnotes" CASCADE;
  ALTER TABLE "articles_rels" DROP CONSTRAINT "articles_rels_pages_fk";
  
  ALTER TABLE "articles_rels" DROP CONSTRAINT "articles_rels_volumes_fk";
  
  ALTER TABLE "articles_rels" DROP CONSTRAINT "articles_rels_articles_fk";
  
  ALTER TABLE "_articles_v_rels" DROP CONSTRAINT "_articles_v_rels_pages_fk";
  
  ALTER TABLE "_articles_v_rels" DROP CONSTRAINT "_articles_v_rels_volumes_fk";
  
  ALTER TABLE "_articles_v_rels" DROP CONSTRAINT "_articles_v_rels_articles_fk";
  
  DROP INDEX "articles_rels_pages_id_idx";
  DROP INDEX "articles_rels_volumes_id_idx";
  DROP INDEX "articles_rels_articles_id_idx";
  DROP INDEX "_articles_v_rels_pages_id_idx";
  DROP INDEX "_articles_v_rels_volumes_id_idx";
  DROP INDEX "_articles_v_rels_articles_id_idx";
  ALTER TABLE "articles_rels" DROP COLUMN "pages_id";
  ALTER TABLE "articles_rels" DROP COLUMN "volumes_id";
  ALTER TABLE "articles_rels" DROP COLUMN "articles_id";
  ALTER TABLE "_articles_v_rels" DROP COLUMN "pages_id";
  ALTER TABLE "_articles_v_rels" DROP COLUMN "volumes_id";
  ALTER TABLE "_articles_v_rels" DROP COLUMN "articles_id";
  DROP TYPE "public"."enum_articles_footnotes_link_type";
  DROP TYPE "public"."enum_articles_footnotes_link_appearance";
  DROP TYPE "public"."enum__articles_v_version_footnotes_link_type";
  DROP TYPE "public"."enum__articles_v_version_footnotes_link_appearance";`)
}
