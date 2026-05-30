/* eslint-disable @typescript-eslint/no-unused-vars */
import { type MigrateUpArgs, type MigrateDownArgs, sql } from "@payloadcms/db-postgres"

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "volumes_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"articles_id" integer
  );

  CREATE TABLE "_volumes_v_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"articles_id" integer
  );

  ALTER TABLE "volumes" ADD COLUMN "meta_title" varchar;
  ALTER TABLE "volumes" ADD COLUMN "meta_image_id" integer;
  ALTER TABLE "volumes" ADD COLUMN "meta_description" varchar;
  ALTER TABLE "_volumes_v" ADD COLUMN "version_meta_title" varchar;
  ALTER TABLE "_volumes_v" ADD COLUMN "version_meta_image_id" integer;
  ALTER TABLE "_volumes_v" ADD COLUMN "version_meta_description" varchar;
  ALTER TABLE "volumes_rels" ADD CONSTRAINT "volumes_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."volumes"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "volumes_rels" ADD CONSTRAINT "volumes_rels_articles_fk" FOREIGN KEY ("articles_id") REFERENCES "public"."articles"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_volumes_v_rels" ADD CONSTRAINT "_volumes_v_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."_volumes_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_volumes_v_rels" ADD CONSTRAINT "_volumes_v_rels_articles_fk" FOREIGN KEY ("articles_id") REFERENCES "public"."articles"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "volumes_rels_order_idx" ON "volumes_rels" USING btree ("order");
  CREATE INDEX "volumes_rels_parent_idx" ON "volumes_rels" USING btree ("parent_id");
  CREATE INDEX "volumes_rels_path_idx" ON "volumes_rels" USING btree ("path");
  CREATE INDEX "volumes_rels_articles_id_idx" ON "volumes_rels" USING btree ("articles_id");
  CREATE INDEX "_volumes_v_rels_order_idx" ON "_volumes_v_rels" USING btree ("order");
  CREATE INDEX "_volumes_v_rels_parent_idx" ON "_volumes_v_rels" USING btree ("parent_id");
  CREATE INDEX "_volumes_v_rels_path_idx" ON "_volumes_v_rels" USING btree ("path");
  CREATE INDEX "_volumes_v_rels_articles_id_idx" ON "_volumes_v_rels" USING btree ("articles_id");
  ALTER TABLE "volumes" ADD CONSTRAINT "volumes_meta_image_id_media_id_fk" FOREIGN KEY ("meta_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_volumes_v" ADD CONSTRAINT "_volumes_v_version_meta_image_id_media_id_fk" FOREIGN KEY ("version_meta_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "volumes_meta_meta_image_idx" ON "volumes" USING btree ("meta_image_id");
  CREATE INDEX "_volumes_v_version_meta_version_meta_image_idx" ON "_volumes_v" USING btree ("version_meta_image_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "volumes_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_volumes_v_rels" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "volumes_rels" CASCADE;
  DROP TABLE "_volumes_v_rels" CASCADE;
  ALTER TABLE "volumes" DROP CONSTRAINT "volumes_meta_image_id_media_id_fk";

  ALTER TABLE "_volumes_v" DROP CONSTRAINT "_volumes_v_version_meta_image_id_media_id_fk";

  DROP INDEX "volumes_meta_meta_image_idx";
  DROP INDEX "_volumes_v_version_meta_version_meta_image_idx";
  ALTER TABLE "volumes" DROP COLUMN "meta_title";
  ALTER TABLE "volumes" DROP COLUMN "meta_image_id";
  ALTER TABLE "volumes" DROP COLUMN "meta_description";
  ALTER TABLE "_volumes_v" DROP COLUMN "version_meta_title";
  ALTER TABLE "_volumes_v" DROP COLUMN "version_meta_image_id";
  ALTER TABLE "_volumes_v" DROP COLUMN "version_meta_description";`)
}
