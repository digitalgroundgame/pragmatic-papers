import { MigrateUpArgs, MigrateDownArgs, sql } from "@payloadcms/db-postgres"

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TYPE "public"."enum_pages_blocks_collection_grid_layout" ADD VALUE 'gauss-10';
  ALTER TYPE "public"."enum__pages_v_blocks_collection_grid_layout" ADD VALUE 'gauss-10';`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "pages_blocks_collection_grid" ALTER COLUMN "layout" SET DATA TYPE text;
  DROP TYPE "public"."enum_pages_blocks_collection_grid_layout";
  CREATE TYPE "public"."enum_pages_blocks_collection_grid_layout" AS ENUM('bernoulli-left', 'bernoulli-right', 'euler-2', 'euler-3', 'newton-4', 'euler-5', 'fibonacci-6', 'vespucci-7', 'fibonacci-7');
  ALTER TABLE "pages_blocks_collection_grid" ALTER COLUMN "layout" SET DATA TYPE "public"."enum_pages_blocks_collection_grid_layout" USING "layout"::"public"."enum_pages_blocks_collection_grid_layout";
  ALTER TABLE "_pages_v_blocks_collection_grid" ALTER COLUMN "layout" SET DATA TYPE text;
  DROP TYPE "public"."enum__pages_v_blocks_collection_grid_layout";
  CREATE TYPE "public"."enum__pages_v_blocks_collection_grid_layout" AS ENUM('bernoulli-left', 'bernoulli-right', 'euler-2', 'euler-3', 'newton-4', 'euler-5', 'fibonacci-6', 'vespucci-7', 'fibonacci-7');
  ALTER TABLE "_pages_v_blocks_collection_grid" ALTER COLUMN "layout" SET DATA TYPE "public"."enum__pages_v_blocks_collection_grid_layout" USING "layout"::"public"."enum__pages_v_blocks_collection_grid_layout";`)
}
