import { MigrateUpArgs, MigrateDownArgs, sql } from "@payloadcms/db-postgres"

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_feeds_list_list" AS ENUM('feeds', 'sitemaps');
  CREATE TYPE "public"."enum__feeds_list_v_list" AS ENUM('feeds', 'sitemaps');
  CREATE TABLE "feeds_list" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"list" "enum_feeds_list_list" DEFAULT 'feeds',
  	"title" varchar,
  	"description" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "_feeds_list_v" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"list" "enum__feeds_list_v_list" DEFAULT 'feeds',
  	"title" varchar,
  	"description" varchar,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  ALTER TABLE "feeds_list" ADD CONSTRAINT "feeds_list_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_feeds_list_v" ADD CONSTRAINT "_feeds_list_v_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "feeds_list_order_idx" ON "feeds_list" USING btree ("_order");
  CREATE INDEX "feeds_list_parent_id_idx" ON "feeds_list" USING btree ("_parent_id");
  CREATE INDEX "feeds_list_path_idx" ON "feeds_list" USING btree ("_path");
  CREATE INDEX "_feeds_list_v_order_idx" ON "_feeds_list_v" USING btree ("_order");
  CREATE INDEX "_feeds_list_v_parent_id_idx" ON "_feeds_list_v" USING btree ("_parent_id");
  CREATE INDEX "_feeds_list_v_path_idx" ON "_feeds_list_v" USING btree ("_path");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "feeds_list" CASCADE;
  DROP TABLE "_feeds_list_v" CASCADE;
  DROP TYPE "public"."enum_feeds_list_list";
  DROP TYPE "public"."enum__feeds_list_v_list";`)
}
