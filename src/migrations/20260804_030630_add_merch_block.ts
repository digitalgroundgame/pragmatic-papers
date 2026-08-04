import { MigrateUpArgs, MigrateDownArgs, sql } from "@payloadcms/db-postgres"

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_pages_blocks_merch_layout" AS ENUM('square', 'fullWidth');
  CREATE TYPE "public"."enum__pages_v_blocks_merch_layout" AS ENUM('square', 'fullWidth');
  CREATE TABLE "pages_blocks_merch_products" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"image_id" integer,
  	"title" varchar,
  	"price" varchar,
  	"badge" varchar,
  	"url" varchar
  );
  
  CREATE TABLE "pages_blocks_merch" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"heading" varchar DEFAULT 'The Pragmatic Papers Store',
  	"layout" "enum_pages_blocks_merch_layout" DEFAULT 'fullWidth',
  	"autoplay" boolean DEFAULT false,
  	"store_url" varchar DEFAULT 'https://pragmaticpapers.org/store',
  	"block_name" varchar
  );
  
  CREATE TABLE "_pages_v_blocks_merch_products" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"image_id" integer,
  	"title" varchar,
  	"price" varchar,
  	"badge" varchar,
  	"url" varchar,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_pages_v_blocks_merch" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"heading" varchar DEFAULT 'The Pragmatic Papers Store',
  	"layout" "enum__pages_v_blocks_merch_layout" DEFAULT 'fullWidth',
  	"autoplay" boolean DEFAULT false,
  	"store_url" varchar DEFAULT 'https://pragmaticpapers.org/store',
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  ALTER TABLE "pages_blocks_merch_products" ADD CONSTRAINT "pages_blocks_merch_products_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "pages_blocks_merch_products" ADD CONSTRAINT "pages_blocks_merch_products_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages_blocks_merch"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_merch" ADD CONSTRAINT "pages_blocks_merch_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_merch_products" ADD CONSTRAINT "_pages_v_blocks_merch_products_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_merch_products" ADD CONSTRAINT "_pages_v_blocks_merch_products_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v_blocks_merch"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_merch" ADD CONSTRAINT "_pages_v_blocks_merch_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "pages_blocks_merch_products_order_idx" ON "pages_blocks_merch_products" USING btree ("_order");
  CREATE INDEX "pages_blocks_merch_products_parent_id_idx" ON "pages_blocks_merch_products" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_merch_products_image_idx" ON "pages_blocks_merch_products" USING btree ("image_id");
  CREATE INDEX "pages_blocks_merch_order_idx" ON "pages_blocks_merch" USING btree ("_order");
  CREATE INDEX "pages_blocks_merch_parent_id_idx" ON "pages_blocks_merch" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_merch_path_idx" ON "pages_blocks_merch" USING btree ("_path");
  CREATE INDEX "_pages_v_blocks_merch_products_order_idx" ON "_pages_v_blocks_merch_products" USING btree ("_order");
  CREATE INDEX "_pages_v_blocks_merch_products_parent_id_idx" ON "_pages_v_blocks_merch_products" USING btree ("_parent_id");
  CREATE INDEX "_pages_v_blocks_merch_products_image_idx" ON "_pages_v_blocks_merch_products" USING btree ("image_id");
  CREATE INDEX "_pages_v_blocks_merch_order_idx" ON "_pages_v_blocks_merch" USING btree ("_order");
  CREATE INDEX "_pages_v_blocks_merch_parent_id_idx" ON "_pages_v_blocks_merch" USING btree ("_parent_id");
  CREATE INDEX "_pages_v_blocks_merch_path_idx" ON "_pages_v_blocks_merch" USING btree ("_path");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "pages_blocks_merch_products" CASCADE;
  DROP TABLE "pages_blocks_merch" CASCADE;
  DROP TABLE "_pages_v_blocks_merch_products" CASCADE;
  DROP TABLE "_pages_v_blocks_merch" CASCADE;
  DROP TYPE "public"."enum_pages_blocks_merch_layout";
  DROP TYPE "public"."enum__pages_v_blocks_merch_layout";`)
}
