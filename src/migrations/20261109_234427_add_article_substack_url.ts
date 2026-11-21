import { MigrateUpArgs, MigrateDownArgs, sql } from "@payloadcms/db-postgres"

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "articles" ADD COLUMN "substack_url" varchar;
  ALTER TABLE "_articles_v" ADD COLUMN "version_substack_url" varchar;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "articles" DROP COLUMN "substack_url";
  ALTER TABLE "_articles_v" DROP COLUMN "version_substack_url";`)
}
