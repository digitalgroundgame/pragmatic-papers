import { MigrateDownArgs, MigrateUpArgs, sql } from "@payloadcms/db-postgres"

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_users_socials_link_type" AS ENUM('reference', 'custom');
  CREATE TABLE "users_socials" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"link_type" "enum_users_socials_link_type" DEFAULT 'reference',
  	"link_new_tab" boolean,
  	"link_url" varchar,
  	"link_label" varchar
  );
  
  CREATE TABLE "users_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"pages_id" integer,
  	"volumes_id" integer,
  	"articles_id" integer
  );
  
  ALTER TABLE "users" ADD COLUMN "affiliation" varchar;
  ALTER TABLE "users" ADD COLUMN "generate_slug" boolean DEFAULT true;
  ALTER TABLE "users" ADD COLUMN "slug" varchar;
  ALTER TABLE "users" ADD COLUMN "profile_image_id" integer;
  UPDATE users SET slug = id::text;
  ALTER TABLE "users" ALTER COLUMN "slug" SET NOT NULL;
  ALTER TABLE "users_socials" ADD CONSTRAINT "users_socials_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "users_rels" ADD CONSTRAINT "users_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "users_rels" ADD CONSTRAINT "users_rels_pages_fk" FOREIGN KEY ("pages_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "users_rels" ADD CONSTRAINT "users_rels_volumes_fk" FOREIGN KEY ("volumes_id") REFERENCES "public"."volumes"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "users_rels" ADD CONSTRAINT "users_rels_articles_fk" FOREIGN KEY ("articles_id") REFERENCES "public"."articles"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "users_socials_order_idx" ON "users_socials" USING btree ("_order");
  CREATE INDEX "users_socials_parent_id_idx" ON "users_socials" USING btree ("_parent_id");
  CREATE INDEX "users_rels_order_idx" ON "users_rels" USING btree ("order");
  CREATE INDEX "users_rels_parent_idx" ON "users_rels" USING btree ("parent_id");
  CREATE INDEX "users_rels_path_idx" ON "users_rels" USING btree ("path");
  CREATE INDEX "users_rels_pages_id_idx" ON "users_rels" USING btree ("pages_id");
  CREATE INDEX "users_rels_volumes_id_idx" ON "users_rels" USING btree ("volumes_id");
  CREATE INDEX "users_rels_articles_id_idx" ON "users_rels" USING btree ("articles_id");
  ALTER TABLE "users" ADD CONSTRAINT "users_profile_image_id_media_id_fk" FOREIGN KEY ("profile_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  CREATE UNIQUE INDEX "users_slug_idx" ON "users" USING btree ("slug");
  CREATE INDEX "users_profile_image_idx" ON "users" USING btree ("profile_image_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "users_socials" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "users_rels" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "users_socials" CASCADE;
  DROP TABLE "users_rels" CASCADE;
  ALTER TABLE "users" DROP CONSTRAINT "users_profile_image_id_media_id_fk";
  
  DROP INDEX "users_slug_idx";
  DROP INDEX "users_profile_image_idx";
  ALTER TABLE "users" DROP COLUMN "affiliation";
  ALTER TABLE "users" DROP COLUMN "generate_slug";
  ALTER TABLE "users" DROP COLUMN "slug";
  ALTER TABLE "users" DROP COLUMN "profile_image_id";
  DROP TYPE "public"."enum_users_socials_link_type";`)
}
