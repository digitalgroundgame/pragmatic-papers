import { MigrateUpArgs, MigrateDownArgs, sql } from "@payloadcms/db-postgres"

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_pages_blocks_collection_grid_layout" AS ENUM('bernoulli-left', 'bernoulli-right', 'euler-2', 'euler-3', 'newton-4', 'euler-5', 'fibonacci-6', 'vespucci-7', 'fibonacci-7');
  CREATE TYPE "public"."enum__pages_v_blocks_collection_grid_layout" AS ENUM('bernoulli-left', 'bernoulli-right', 'euler-2', 'euler-3', 'newton-4', 'euler-5', 'fibonacci-6', 'vespucci-7', 'fibonacci-7');
  CREATE TABLE "pages_blocks_collection_grid_slots" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"kicker" varchar,
  	"override_title" varchar
  );
  
  CREATE TABLE "pages_blocks_collection_grid" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"layout" "enum_pages_blocks_collection_grid_layout",
  	"block_name" varchar
  );
  
  CREATE TABLE "_pages_v_blocks_collection_grid_slots" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"kicker" varchar,
  	"override_title" varchar,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_pages_v_blocks_collection_grid" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"layout" "enum__pages_v_blocks_collection_grid_layout",
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  ALTER TABLE "pages_blocks_collection_grid_slots" ADD CONSTRAINT "pages_blocks_collection_grid_slots_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages_blocks_collection_grid"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_collection_grid" ADD CONSTRAINT "pages_blocks_collection_grid_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_collection_grid_slots" ADD CONSTRAINT "_pages_v_blocks_collection_grid_slots_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v_blocks_collection_grid"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_collection_grid" ADD CONSTRAINT "_pages_v_blocks_collection_grid_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "pages_blocks_collection_grid_slots_order_idx" ON "pages_blocks_collection_grid_slots" USING btree ("_order");
  CREATE INDEX "pages_blocks_collection_grid_slots_parent_id_idx" ON "pages_blocks_collection_grid_slots" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_collection_grid_order_idx" ON "pages_blocks_collection_grid" USING btree ("_order");
  CREATE INDEX "pages_blocks_collection_grid_parent_id_idx" ON "pages_blocks_collection_grid" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_collection_grid_path_idx" ON "pages_blocks_collection_grid" USING btree ("_path");
  CREATE INDEX "_pages_v_blocks_collection_grid_slots_order_idx" ON "_pages_v_blocks_collection_grid_slots" USING btree ("_order");
  CREATE INDEX "_pages_v_blocks_collection_grid_slots_parent_id_idx" ON "_pages_v_blocks_collection_grid_slots" USING btree ("_parent_id");
  CREATE INDEX "_pages_v_blocks_collection_grid_order_idx" ON "_pages_v_blocks_collection_grid" USING btree ("_order");
  CREATE INDEX "_pages_v_blocks_collection_grid_parent_id_idx" ON "_pages_v_blocks_collection_grid" USING btree ("_parent_id");
  CREATE INDEX "_pages_v_blocks_collection_grid_path_idx" ON "_pages_v_blocks_collection_grid" USING btree ("_path");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "pages_blocks_collection_grid_slots" CASCADE;
  DROP TABLE "pages_blocks_collection_grid" CASCADE;
  DROP TABLE "_pages_v_blocks_collection_grid_slots" CASCADE;
  DROP TABLE "_pages_v_blocks_collection_grid" CASCADE;
  DROP TYPE "public"."enum_pages_blocks_collection_grid_layout";
  DROP TYPE "public"."enum__pages_v_blocks_collection_grid_layout";`)
}
