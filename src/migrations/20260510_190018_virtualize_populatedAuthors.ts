import { MigrateUpArgs, MigrateDownArgs, sql } from "@payloadcms/db-postgres"

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "articles_populated_authors_socials" CASCADE;
  DROP TABLE "articles_populated_authors" CASCADE;
  DROP TABLE "_articles_v_version_populated_authors_socials" CASCADE;
  DROP TABLE "_articles_v_version_populated_authors" CASCADE;
  DROP TYPE "public"."enum_articles_populated_authors_socials_link_type";
  DROP TYPE "public"."enum_articles_populated_authors_socials_link_variant";
  DROP TYPE "public"."enum__articles_v_version_populated_authors_socials_link_type";
  DROP TYPE "public"."enum__articles_v_version_populated_authors_socials_link_variant";`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_articles_populated_authors_socials_link_type" AS ENUM('reference', 'custom');
  CREATE TYPE "public"."enum_articles_populated_authors_socials_link_variant" AS ENUM('link', 'default', 'outline', 'ghost', 'branded');
  CREATE TYPE "public"."enum__articles_v_version_populated_authors_socials_link_type" AS ENUM('reference', 'custom');
  CREATE TYPE "public"."enum__articles_v_version_populated_authors_socials_link_variant" AS ENUM('link', 'default', 'outline', 'ghost', 'branded');
  CREATE TABLE "articles_populated_authors_socials" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"link_type" "enum_articles_populated_authors_socials_link_type" DEFAULT 'reference',
  	"link_new_tab" boolean,
  	"link_variant" "enum_articles_populated_authors_socials_link_variant" DEFAULT 'link',
  	"link_url" varchar,
  	"link_label" varchar
  );
  
  CREATE TABLE "articles_populated_authors" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"name" varchar,
  	"slug" varchar,
  	"affiliation" varchar,
  	"biography" jsonb,
  	"profile_image_id" integer
  );
  
  CREATE TABLE "_articles_v_version_populated_authors_socials" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"link_type" "enum__articles_v_version_populated_authors_socials_link_type" DEFAULT 'reference',
  	"link_new_tab" boolean,
  	"link_variant" "enum__articles_v_version_populated_authors_socials_link_variant" DEFAULT 'link',
  	"link_url" varchar,
  	"link_label" varchar,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_articles_v_version_populated_authors" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_uuid" varchar,
  	"name" varchar,
  	"slug" varchar,
  	"affiliation" varchar,
  	"biography" jsonb,
  	"profile_image_id" integer
  );
  
  ALTER TABLE "articles_populated_authors_socials" ADD CONSTRAINT "articles_populated_authors_socials_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."articles_populated_authors"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "articles_populated_authors" ADD CONSTRAINT "articles_populated_authors_profile_image_id_media_id_fk" FOREIGN KEY ("profile_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "articles_populated_authors" ADD CONSTRAINT "articles_populated_authors_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."articles"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_articles_v_version_populated_authors_socials" ADD CONSTRAINT "_articles_v_version_populated_authors_socials_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_articles_v_version_populated_authors"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_articles_v_version_populated_authors" ADD CONSTRAINT "_articles_v_version_populated_authors_profile_image_id_media_id_fk" FOREIGN KEY ("profile_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_articles_v_version_populated_authors" ADD CONSTRAINT "_articles_v_version_populated_authors_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_articles_v"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "articles_populated_authors_socials_order_idx" ON "articles_populated_authors_socials" USING btree ("_order");
  CREATE INDEX "articles_populated_authors_socials_parent_id_idx" ON "articles_populated_authors_socials" USING btree ("_parent_id");
  CREATE INDEX "articles_populated_authors_order_idx" ON "articles_populated_authors" USING btree ("_order");
  CREATE INDEX "articles_populated_authors_parent_id_idx" ON "articles_populated_authors" USING btree ("_parent_id");
  CREATE INDEX "articles_populated_authors_profile_image_idx" ON "articles_populated_authors" USING btree ("profile_image_id");
  CREATE INDEX "_articles_v_version_populated_authors_socials_order_idx" ON "_articles_v_version_populated_authors_socials" USING btree ("_order");
  CREATE INDEX "_articles_v_version_populated_authors_socials_parent_id_idx" ON "_articles_v_version_populated_authors_socials" USING btree ("_parent_id");
  CREATE INDEX "_articles_v_version_populated_authors_order_idx" ON "_articles_v_version_populated_authors" USING btree ("_order");
  CREATE INDEX "_articles_v_version_populated_authors_parent_id_idx" ON "_articles_v_version_populated_authors" USING btree ("_parent_id");
  CREATE INDEX "_articles_v_version_populated_authors_profile_image_idx" ON "_articles_v_version_populated_authors" USING btree ("profile_image_id");`)
}
