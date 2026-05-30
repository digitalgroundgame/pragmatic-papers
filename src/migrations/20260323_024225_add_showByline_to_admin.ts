import { MigrateUpArgs, MigrateDownArgs, sql } from "@payloadcms/db-postgres"

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "pages_blocks_collection_grid_slots" ADD COLUMN "show_byline" boolean DEFAULT false;
  ALTER TABLE "_pages_v_blocks_collection_grid_slots" ADD COLUMN "show_byline" boolean DEFAULT false;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "pages_blocks_collection_grid_slots" DROP COLUMN "show_byline";
  ALTER TABLE "_pages_v_blocks_collection_grid_slots" DROP COLUMN "show_byline";`)
}
