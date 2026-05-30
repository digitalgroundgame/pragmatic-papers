import { MigrateUpArgs, MigrateDownArgs, sql } from "@payloadcms/db-postgres"

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "pages_blocks_contributors" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"title" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "_pages_v_blocks_contributors" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  ALTER TABLE "pages_rels" ADD COLUMN "users_id" integer;
  ALTER TABLE "_pages_v_rels" ADD COLUMN "users_id" integer;
  ALTER TABLE "pages_blocks_contributors" ADD CONSTRAINT "pages_blocks_contributors_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_contributors" ADD CONSTRAINT "_pages_v_blocks_contributors_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "pages_blocks_contributors_order_idx" ON "pages_blocks_contributors" USING btree ("_order");
  CREATE INDEX "pages_blocks_contributors_parent_id_idx" ON "pages_blocks_contributors" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_contributors_path_idx" ON "pages_blocks_contributors" USING btree ("_path");
  CREATE INDEX "_pages_v_blocks_contributors_order_idx" ON "_pages_v_blocks_contributors" USING btree ("_order");
  CREATE INDEX "_pages_v_blocks_contributors_parent_id_idx" ON "_pages_v_blocks_contributors" USING btree ("_parent_id");
  CREATE INDEX "_pages_v_blocks_contributors_path_idx" ON "_pages_v_blocks_contributors" USING btree ("_path");
  ALTER TABLE "pages_rels" ADD CONSTRAINT "pages_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_rels" ADD CONSTRAINT "_pages_v_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "pages_rels_users_id_idx" ON "pages_rels" USING btree ("users_id");
  CREATE INDEX "_pages_v_rels_users_id_idx" ON "_pages_v_rels" USING btree ("users_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "pages_blocks_contributors" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_pages_v_blocks_contributors" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "pages_blocks_contributors" CASCADE;
  DROP TABLE "_pages_v_blocks_contributors" CASCADE;
  ALTER TABLE "pages_rels" DROP CONSTRAINT "pages_rels_users_fk";
  
  ALTER TABLE "_pages_v_rels" DROP CONSTRAINT "_pages_v_rels_users_fk";
  
  DROP INDEX "pages_rels_users_id_idx";
  DROP INDEX "_pages_v_rels_users_id_idx";
  ALTER TABLE "pages_rels" DROP COLUMN "users_id";
  ALTER TABLE "_pages_v_rels" DROP COLUMN "users_id";`)
}
