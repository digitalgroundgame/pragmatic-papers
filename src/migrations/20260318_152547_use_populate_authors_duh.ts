import { MigrateUpArgs, MigrateDownArgs, sql } from "@payloadcms/db-postgres"

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_articles_populated_authors_socials_link_type" AS ENUM('reference', 'custom');
  CREATE TYPE "public"."enum__articles_v_version_populated_authors_socials_link_type" AS ENUM('reference', 'custom');
  CREATE TABLE "articles_populated_authors_socials" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"link_type" "enum_articles_populated_authors_socials_link_type" DEFAULT 'reference',
  	"link_new_tab" boolean,
  	"link_url" varchar,
  	"link_label" varchar
  );
  
  CREATE TABLE "_articles_v_version_populated_authors_socials" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"link_type" "enum__articles_v_version_populated_authors_socials_link_type" DEFAULT 'reference',
  	"link_new_tab" boolean,
  	"link_url" varchar,
  	"link_label" varchar,
  	"_uuid" varchar
  );
  
  ALTER TABLE "articles_populated_authors" ADD COLUMN "slug" varchar;
  ALTER TABLE "articles_populated_authors" ADD COLUMN "affiliation" varchar;
  ALTER TABLE "articles_populated_authors" ADD COLUMN "biography" jsonb;
  ALTER TABLE "articles_populated_authors" ADD COLUMN "profile_image_id" integer;
  ALTER TABLE "_articles_v_version_populated_authors" ADD COLUMN "slug" varchar;
  ALTER TABLE "_articles_v_version_populated_authors" ADD COLUMN "affiliation" varchar;
  ALTER TABLE "_articles_v_version_populated_authors" ADD COLUMN "biography" jsonb;
  ALTER TABLE "_articles_v_version_populated_authors" ADD COLUMN "profile_image_id" integer;
  ALTER TABLE "articles_populated_authors_socials" ADD CONSTRAINT "articles_populated_authors_socials_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."articles_populated_authors"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_articles_v_version_populated_authors_socials" ADD CONSTRAINT "_articles_v_version_populated_authors_socials_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_articles_v_version_populated_authors"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "articles_populated_authors_socials_order_idx" ON "articles_populated_authors_socials" USING btree ("_order");
  CREATE INDEX "articles_populated_authors_socials_parent_id_idx" ON "articles_populated_authors_socials" USING btree ("_parent_id");
  CREATE INDEX "_articles_v_version_populated_authors_socials_order_idx" ON "_articles_v_version_populated_authors_socials" USING btree ("_order");
  CREATE INDEX "_articles_v_version_populated_authors_socials_parent_id_idx" ON "_articles_v_version_populated_authors_socials" USING btree ("_parent_id");
  ALTER TABLE "articles_populated_authors" ADD CONSTRAINT "articles_populated_authors_profile_image_id_media_id_fk" FOREIGN KEY ("profile_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_articles_v_version_populated_authors" ADD CONSTRAINT "_articles_v_version_populated_authors_profile_image_id_media_id_fk" FOREIGN KEY ("profile_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "articles_populated_authors_profile_image_idx" ON "articles_populated_authors" USING btree ("profile_image_id");
  CREATE INDEX "_articles_v_version_populated_authors_profile_image_idx" ON "_articles_v_version_populated_authors" USING btree ("profile_image_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "articles_populated_authors_socials" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_articles_v_version_populated_authors_socials" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "articles_populated_authors_socials" CASCADE;
  DROP TABLE "_articles_v_version_populated_authors_socials" CASCADE;
  ALTER TABLE "articles_populated_authors" DROP CONSTRAINT "articles_populated_authors_profile_image_id_media_id_fk";
  
  ALTER TABLE "_articles_v_version_populated_authors" DROP CONSTRAINT "_articles_v_version_populated_authors_profile_image_id_media_id_fk";
  
  DROP INDEX "articles_populated_authors_profile_image_idx";
  DROP INDEX "_articles_v_version_populated_authors_profile_image_idx";
  ALTER TABLE "articles_populated_authors" DROP COLUMN "slug";
  ALTER TABLE "articles_populated_authors" DROP COLUMN "affiliation";
  ALTER TABLE "articles_populated_authors" DROP COLUMN "biography";
  ALTER TABLE "articles_populated_authors" DROP COLUMN "profile_image_id";
  ALTER TABLE "_articles_v_version_populated_authors" DROP COLUMN "slug";
  ALTER TABLE "_articles_v_version_populated_authors" DROP COLUMN "affiliation";
  ALTER TABLE "_articles_v_version_populated_authors" DROP COLUMN "biography";
  ALTER TABLE "_articles_v_version_populated_authors" DROP COLUMN "profile_image_id";
  DROP TYPE "public"."enum_articles_populated_authors_socials_link_type";
  DROP TYPE "public"."enum__articles_v_version_populated_authors_socials_link_type";`)
}
